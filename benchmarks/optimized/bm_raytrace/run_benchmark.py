"""
This file contains definitions for a simple raytracer.
Copyright Callum and Tony Garnock-Jones, 2008.

This file may be freely redistributed under the MIT license,
http://www.opensource.org/licenses/mit-license.php

From http://www.lshift.net/blog/2008/10/29/toy-raytracer-in-python
"""

import array
import math

import pyperf


DEFAULT_WIDTH = 100
DEFAULT_HEIGHT = 100
EPSILON = 0.00001

# OPTIMIZATION: bind math.sqrt once at module level. The renderer calls it on
# every ray/sphere intersection and every vector normalisation, and a global
# lookup ("math" -> attribute "sqrt") on each call is pure interpreter overhead.
_sqrt = math.sqrt


class Vector(object):
    # OPTIMIZATION 1: __slots__. Millions of Vectors are created per frame and
    # each one carried a full per-instance __dict__ (~104 bytes of overhead);
    # with slots the object is three unboxed references and attribute access is
    # a slot load rather than a dict probe.
    __slots__ = ('x', 'y', 'z')

    # OPTIMIZATION 2: replace the isPoint()/mustBeVector() *method calls* with a
    # class-level flag. The original performed a full Python method call on
    # every single arithmetic operation purely to assert operand types. A class
    # attribute load is dramatically cheaper, and the type assertions in dot(),
    # __sub__() and cross() are removed entirely -- they only ever raised for
    # programs that were already broken.
    _isPoint = False

    def __init__(self, initx, inity, initz):
        self.x = initx
        self.y = inity
        self.z = initz

    def __str__(self):
        return '(%s,%s,%s)' % (self.x, self.y, self.z)

    def __repr__(self):
        return 'Vector(%s,%s,%s)' % (self.x, self.y, self.z)

    def magnitude(self):
        x = self.x
        y = self.y
        z = self.z
        return _sqrt(x * x + y * y + z * z)

    def __add__(self, other):
        if other._isPoint:
            return Point(self.x + other.x, self.y + other.y, self.z + other.z)
        else:
            return Vector(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other):
        return Vector(self.x - other.x, self.y - other.y, self.z - other.z)

    def scale(self, factor):
        return Vector(factor * self.x, factor * self.y, factor * self.z)

    def dot(self, other):
        return (self.x * other.x) + (self.y * other.y) + (self.z * other.z)

    def cross(self, other):
        return Vector(self.y * other.z - self.z * other.y,
                      self.z * other.x - self.x * other.z,
                      self.x * other.y - self.y * other.x)

    def normalized(self):
        # OPTIMIZATION 3: the original was scale(1.0 / magnitude()), and
        # magnitude() was sqrt(dot(self)), and dot() called mustBeVector() --
        # a five-deep call chain plus a throwaway Vector, executed for every
        # Ray constructed. Inlined to one sqrt and one allocation.
        x = self.x
        y = self.y
        z = self.z
        f = 1.0 / _sqrt(x * x + y * y + z * z)
        return Vector(x * f, y * f, z * f)

    def negated(self):
        return self.scale(-1)

    def __eq__(self, other):
        return (self.x == other.x) and (self.y == other.y) and (self.z == other.z)

    def isVector(self):
        return True

    def isPoint(self):
        return False

    def mustBeVector(self):
        return self

    def mustBePoint(self):
        raise 'Vectors are not points!'

    def reflectThrough(self, normal):
        d = normal.scale(self.dot(normal))
        return self - d.scale(2)


Vector.ZERO = Vector(0, 0, 0)
Vector.RIGHT = Vector(1, 0, 0)
Vector.UP = Vector(0, 1, 0)
Vector.OUT = Vector(0, 0, 1)

assert Vector.RIGHT.reflectThrough(Vector.UP) == Vector.RIGHT
assert Vector(-1, -1, 0).reflectThrough(Vector.UP) == Vector(-1, 1, 0)


class Point(object):
    __slots__ = ('x', 'y', 'z')
    _isPoint = True

    def __init__(self, initx, inity, initz):
        self.x = initx
        self.y = inity
        self.z = initz

    def __str__(self):
        return '(%s,%s,%s)' % (self.x, self.y, self.z)

    def __repr__(self):
        return 'Point(%s,%s,%s)' % (self.x, self.y, self.z)

    def __add__(self, other):
        return Point(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other):
        if other._isPoint:
            return Vector(self.x - other.x, self.y - other.y, self.z - other.z)
        else:
            return Point(self.x - other.x, self.y - other.y, self.z - other.z)

    def isVector(self):
        return False

    def isPoint(self):
        return True

    def mustBeVector(self):
        raise 'Points are not vectors!'

    def mustBePoint(self):
        return self


class Sphere(object):
    __slots__ = ('centre', 'radius')

    def __init__(self, centre, radius):
        centre.mustBePoint()
        self.centre = centre
        self.radius = radius

    def __repr__(self):
        return 'Sphere(%s,%s)' % (repr(self.centre), self.radius)

    def intersectionTime(self, ray):
        # OPTIMIZATION 4: this is the hottest function in the benchmark -- it
        # runs once per scene object per ray, including every shadow ray. The
        # original allocated an intermediate Vector (self.centre - ray.point)
        # and made two dot() calls, each of which also called mustBeVector().
        # Working directly on the scalar components removes one allocation and
        # three method calls per object per ray, with identical arithmetic.
        centre = self.centre
        p = ray.point
        cx = centre.x - p.x
        cy = centre.y - p.y
        cz = centre.z - p.z
        rv = ray.vector
        v = cx * rv.x + cy * rv.y + cz * rv.z
        r = self.radius
        discriminant = (r * r) - (cx * cx + cy * cy + cz * cz - v * v)
        if discriminant < 0:
            return None
        else:
            return v - _sqrt(discriminant)

    def normalAt(self, p):
        return (p - self.centre).normalized()


class Halfspace(object):
    __slots__ = ('point', 'normal')

    def __init__(self, point, normal):
        self.point = point
        self.normal = normal.normalized()

    def __repr__(self):
        return 'Halfspace(%s,%s)' % (repr(self.point), repr(self.normal))

    def intersectionTime(self, ray):
        v = ray.vector.dot(self.normal)
        if v:
            return 1 / -v
        else:
            return None

    def normalAt(self, p):
        return self.normal


class Ray(object):
    __slots__ = ('point', 'vector')

    def __init__(self, point, vector):
        self.point = point
        self.vector = vector.normalized()

    def __repr__(self):
        return 'Ray(%s,%s)' % (repr(self.point), repr(self.vector))

    def pointAtTime(self, t):
        return self.point + self.vector.scale(t)


Point.ZERO = Point(0, 0, 0)


class Canvas(object):
    __slots__ = ('bytes', 'width', 'height')

    def __init__(self, width, height):
        self.bytes = array.array('B', [0] * (width * height * 3))
        for i in range(width * height):
            self.bytes[i * 3 + 2] = 255
        self.width = width
        self.height = height

    def plot(self, x, y, r, g, b):
        i = ((self.height - y - 1) * self.width + x) * 3
        self.bytes[i] = max(0, min(255, int(r * 255)))
        self.bytes[i + 1] = max(0, min(255, int(g * 255)))
        self.bytes[i + 2] = max(0, min(255, int(b * 255)))

    def write_ppm(self, filename):
        header = 'P6 %d %d 255\n' % (self.width, self.height)
        with open(filename, "wb") as fp:
            fp.write(header.encode('ascii'))
            fp.write(self.bytes.tobytes())


def firstIntersection(intersections):
    result = None
    for i in intersections:
        candidateT = i[1]
        if candidateT is not None and candidateT > -EPSILON:
            if result is None or candidateT < result[1]:
                result = i
    return result


class Scene(object):
    __slots__ = ('objects', 'lightPoints', 'position', 'lookingAt',
                 'fieldOfView', 'recursionDepth')

    def __init__(self):
        self.objects = []
        self.lightPoints = []
        self.position = Point(0, 1.8, 10)
        self.lookingAt = Point.ZERO
        self.fieldOfView = 45
        self.recursionDepth = 0

    def moveTo(self, p):
        self.position = p

    def lookAt(self, p):
        self.lookingAt = p

    def addObject(self, object, surface):
        self.objects.append((object, surface))

    def addLight(self, p):
        self.lightPoints.append(p)

    def render(self, canvas):
        fovRadians = math.pi * (self.fieldOfView / 2.0) / 180.0
        halfWidth = math.tan(fovRadians)
        halfHeight = 0.75 * halfWidth
        width = halfWidth * 2
        height = halfHeight * 2
        pixelWidth = width / (canvas.width - 1)
        pixelHeight = height / (canvas.height - 1)

        eye = Ray(self.position, self.lookingAt - self.position)
        vpRight = eye.vector.cross(Vector.UP).normalized()
        vpUp = vpRight.cross(eye.vector).normalized()

        for y in range(canvas.height):
            for x in range(canvas.width):
                xcomp = vpRight.scale(x * pixelWidth - halfWidth)
                ycomp = vpUp.scale(y * pixelHeight - halfHeight)
                ray = Ray(eye.point, eye.vector + xcomp + ycomp)
                colour = self.rayColour(ray)
                canvas.plot(x, y, *colour)

    def rayColour(self, ray):
        if self.recursionDepth > 3:
            return (0, 0, 0)
        try:
            self.recursionDepth = self.recursionDepth + 1
            # OPTIMIZATION 6: the original materialised a list of
            # (object, time, surface) tuples for every scene object on every
            # ray, then scanned that list in firstIntersection() to pick the
            # nearest hit. Fusing the two removes one list plus one tuple per
            # object per ray. The selection rule is unchanged: nearest hit with
            # t > -EPSILON.
            i = None
            bestT = None
            for (o, s) in self.objects:
                t = o.intersectionTime(ray)
                if t is not None and t > -EPSILON:
                    if bestT is None or t < bestT:
                        bestT = t
                        i = (o, t, s)
            if i is None:
                return (0, 0, 0)  # the background colour
            else:
                (o, t, s) = i
                p = ray.pointAtTime(t)
                return s.colourAt(self, ray, p, o.normalAt(p))
        finally:
            self.recursionDepth = self.recursionDepth - 1

    def _lightIsVisible(self, l, p):
        # OPTIMIZATION 5: loop-invariant hoist. The original constructed
        # Ray(p, l - p) *inside* the loop, so the same shadow ray was rebuilt --
        # including a Vector subtraction and a normalisation -- once per scene
        # object. l and p do not change in the loop, so the ray is identical
        # every iteration; building it once is exactly equivalent.
        ray = Ray(p, l - p)
        for (o, s) in self.objects:
            t = o.intersectionTime(ray)
            if t is not None and t > EPSILON:
                return False
        return True

    def visibleLights(self, p):
        result = []
        for l in self.lightPoints:
            if self._lightIsVisible(l, p):
                result.append(l)
        return result


def addColours(a, scale, b):
    return (a[0] + scale * b[0],
            a[1] + scale * b[1],
            a[2] + scale * b[2])


class SimpleSurface(object):
    __slots__ = ('baseColour', 'specularCoefficient', 'lambertCoefficient',
                 'ambientCoefficient')

    def __init__(self, **kwargs):
        self.baseColour = kwargs.get('baseColour', (1, 1, 1))
        self.specularCoefficient = kwargs.get('specularCoefficient', 0.2)
        self.lambertCoefficient = kwargs.get('lambertCoefficient', 0.6)
        self.ambientCoefficient = 1.0 - self.specularCoefficient - self.lambertCoefficient

    def baseColourAt(self, p):
        return self.baseColour

    def colourAt(self, scene, ray, p, normal):
        b = self.baseColourAt(p)

        c = (0, 0, 0)
        if self.specularCoefficient > 0:
            reflectedRay = Ray(p, ray.vector.reflectThrough(normal))
            reflectedColour = scene.rayColour(reflectedRay)
            c = addColours(c, self.specularCoefficient, reflectedColour)

        if self.lambertCoefficient > 0:
            lambertAmount = 0
            for lightPoint in scene.visibleLights(p):
                contribution = (lightPoint - p).normalized().dot(normal)
                if contribution > 0:
                    lambertAmount = lambertAmount + contribution
            lambertAmount = min(1, lambertAmount)
            c = addColours(c, self.lambertCoefficient * lambertAmount, b)

        if self.ambientCoefficient > 0:
            c = addColours(c, self.ambientCoefficient, b)

        return c


class CheckerboardSurface(SimpleSurface):
    __slots__ = ('otherColour', 'checkSize')

    def __init__(self, **kwargs):
        SimpleSurface.__init__(self, **kwargs)
        self.otherColour = kwargs.get('otherColour', (0, 0, 0))
        self.checkSize = kwargs.get('checkSize', 1)

    def baseColourAt(self, p):
        v = p - Point.ZERO
        # NOTE: the original called v.scale(1.0 / self.checkSize) here and threw
        # the result away -- a dead allocation per shading query. Removed; the
        # rendered image is unchanged because scale() has no side effects.
        if ((int(abs(v.x) + 0.5)
             + int(abs(v.y) + 0.5)
             + int(abs(v.z) + 0.5)) % 2):
            return self.otherColour
        else:
            return self.baseColour


def bench_raytrace(loops, width, height, filename):
    range_it = range(loops)
    t0 = pyperf.perf_counter()

    for i in range_it:
        canvas = Canvas(width, height)
        s = Scene()
        s.addLight(Point(30, 30, 10))
        s.addLight(Point(-10, 100, 30))
        s.lookAt(Point(0, 3, 0))
        s.addObject(Sphere(Point(1, 3, -10), 2),
                    SimpleSurface(baseColour=(1, 1, 0)))
        for y in range(6):
            s.addObject(Sphere(Point(-3 - y * 0.4, 2.3, -5), 0.4),
                        SimpleSurface(baseColour=(y / 6.0, 1 - y / 6.0, 0.5)))
        s.addObject(Halfspace(Point(0, 0, 0), Vector.UP),
                    CheckerboardSurface())
        s.render(canvas)

    dt = pyperf.perf_counter() - t0

    if filename:
        canvas.write_ppm(filename)
    return dt


def add_cmdline_args(cmd, args):
    cmd.append("--width=%s" % args.width)
    cmd.append("--height=%s" % args.height)
    if args.filename:
        cmd.extend(("--filename", args.filename))


if __name__ == "__main__":
    runner = pyperf.Runner(add_cmdline_args=add_cmdline_args)
    cmd = runner.argparser
    cmd.add_argument("--width",
                     type=int, default=DEFAULT_WIDTH,
                     help="Image width (default: %s)" % DEFAULT_WIDTH)
    cmd.add_argument("--height",
                     type=int, default=DEFAULT_HEIGHT,
                     help="Image height (default: %s)" % DEFAULT_HEIGHT)
    cmd.add_argument("--filename", metavar="FILENAME.PPM",
                     help="Output filename of the PPM picture")

    args = runner.parse_args()
    runner.metadata['description'] = "Simple raytracer"
    runner.metadata['raytrace_width'] = args.width
    runner.metadata['raytrace_height'] = args.height

    runner.bench_time_func('raytrace', bench_raytrace,
                           args.width, args.height,
                           args.filename)
