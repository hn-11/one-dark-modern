// C++ fixture for the flicker audit.
//
// Written to exercise the semanticTokenColors entries the Go/TS fixtures never
// reach: `macro`, `typeParameter`, `enum`/`struct`/`class`, `variable.constant`
// and operator overloads. Header-only and self-contained so clangd can parse it
// with nothing but the flags in `.clangd`.

#include <cstdint>
#include <string>
#include <vector>

#define AUDIT_VERSION 3
#define SQUARE(x) ((x) * (x))
#define LOG_PREFIX "[audit] "

namespace audit {
namespace geometry {

inline constexpr int kMaxItems = 64;
inline constexpr double kPi = 3.14159265358979;
static const std::string kTableName = "items";

enum class Kind : std::uint8_t {
  Point,
  Circle,
  Rect,
};

enum Legacy { LEGACY_A, LEGACY_B };

struct Vec2 {
  double x = 0.0;
  double y = 0.0;

  constexpr Vec2 operator+(const Vec2& rhs) const { return Vec2{x + rhs.x, y + rhs.y}; }
  constexpr Vec2 operator*(double k) const { return Vec2{x * k, y * k}; }
  constexpr bool operator==(const Vec2& rhs) const { return x == rhs.x && y == rhs.y; }
  double& operator[](int i) { return i == 0 ? x : y; }
  Vec2& operator+=(const Vec2& rhs) {
    x += rhs.x;
    y += rhs.y;
    return *this;
  }
};

class Shape {
 public:
  explicit Shape(Kind kind) : kind_(kind) {}
  virtual ~Shape() = default;

  virtual double Area() const = 0;
  Kind kind() const { return kind_; }

 private:
  Kind kind_;
};

class Circle final : public Shape {
 public:
  explicit Circle(double radius) : Shape(Kind::Circle), radius_(radius) {}
  double Area() const override { return kPi * SQUARE(radius_); }

 private:
  double radius_;
};

template <typename T>
class Bucket {
 public:
  using value_type = T;

  explicit Bucket(std::string label) : label_(std::move(label)) {}

  Bucket& Push(const T& item) {
    if (static_cast<int>(items_.size()) < kMaxItems) items_.push_back(item);
    return *this;
  }

  const T& operator[](std::size_t i) const { return items_[i]; }
  std::size_t size() const { return items_.size(); }
  const std::string& label() const { return label_; }

 private:
  std::string label_;
  std::vector<T> items_;
};

template <typename T, typename U>
constexpr auto Sum(const T& a, const U& b) -> decltype(a + b) {
  return a + b;
}

template <typename T>
T Largest(const std::vector<T>& list) {
  T best = list.front();
  for (const T& v : list)
    if (best < v) best = v;
  return best;
}

}  // namespace geometry
}  // namespace audit

int main() {
  using audit::geometry::Bucket;
  using audit::geometry::Circle;
  using audit::geometry::Kind;
  using audit::geometry::Vec2;

  Vec2 a{1.0, 2.0};
  Vec2 b{3.0, 4.0};
  Vec2 c = a + b * 2.0;
  c += a;
  const bool same = (a == b);
  const double first = c[0];

  Circle circle{2.5};
  Bucket<double> bucket{audit::geometry::kTableName};
  bucket.Push(circle.Area()).Push(first);

  auto total = audit::geometry::Sum(1, 2.5);
  auto biggest = audit::geometry::Largest<int>({3, 9, 4});

  return static_cast<int>(bucket.size()) + AUDIT_VERSION +
         (same ? 1 : 0) + (circle.kind() == Kind::Circle ? 1 : 0) +
         static_cast<int>(total) + biggest;
}
