//! Rust fixture for the flicker audit.
//!
//! Written to exercise the semanticTokenColors entries no other fixture
//! reaches: `macro`, `typeParameter`, `variable.constant`, `enum`, `struct`,
//! and `string.format`. Everything here must compile with plain `cargo check`
//! so rust-analyzer can resolve it without a network fetch.

use std::collections::HashMap;
use std::fmt::{self, Display};

/// variable.constant / variable.readonly territory.
const MAX_ITEMS: usize = 64;
const GREETING: &str = "hello";
static TABLE_NAME: &str = "items";

/// A user-defined `macro_rules!` macro: the `macro` semantic token type.
macro_rules! square {
    ($x:expr) => {
        $x * $x
    };
}

macro_rules! named_pair {
    ($name:ident, $a:expr, $b:expr) => {
        fn $name() -> (i32, i32) {
            ($a, $b)
        }
    };
}

named_pair!(origin_pair, 0, 1);

/// struct + typeParameter + lifetime.
#[derive(Debug, Clone)]
pub struct Bucket<'a, T> {
    pub label: &'a str,
    pub items: Vec<T>,
    count: usize,
}

/// enum + enumMember.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Shape {
    Point,
    Circle { radius: u32 },
    Rect(u32, u32),
}

/// A trait with an associated type and a generic method.
pub trait Measured {
    type Unit;

    fn area(&self) -> u64;

    fn describe(&self) -> String {
        format!("area = {}", self.area())
    }
}

impl Measured for Shape {
    type Unit = u32;

    fn area(&self) -> u64 {
        match *self {
            Shape::Point => 0,
            Shape::Circle { radius } => (3 * square!(radius)) as u64,
            Shape::Rect(w, h) => (w as u64) * (h as u64),
        }
    }
}

impl Display for Shape {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Shape({:?})", self)
    }
}

impl<'a, T: Clone + Display> Bucket<'a, T> {
    pub fn new(label: &'a str) -> Self {
        Bucket {
            label,
            items: Vec::new(),
            count: 0,
        }
    }

    pub fn push(&mut self, item: T) -> &mut Self {
        if self.count < MAX_ITEMS {
            self.items.push(item);
            self.count += 1;
        }
        self
    }

    pub fn render<F>(&self, sep: &str, mut f: F) -> String
    where
        F: FnMut(&T) -> String,
    {
        let parts: Vec<String> = self.items.iter().map(|it| f(it)).collect();
        parts.join(sep)
    }
}

fn largest<T: PartialOrd + Copy>(list: &[T]) -> Option<T> {
    let mut it = list.iter();
    let first = *it.next()?;
    Some(it.fold(first, |acc, &x| if x > acc { x } else { acc }))
}

fn tally(shapes: &[Shape]) -> HashMap<&'static str, u64> {
    let mut out: HashMap<&'static str, u64> = HashMap::new();
    for s in shapes {
        let key = match s {
            Shape::Point => "point",
            Shape::Circle { .. } => "circle",
            Shape::Rect(_, _) => "rect",
        };
        *out.entry(key).or_insert(0) += s.area();
    }
    out
}

fn main() {
    let shapes = vec![
        Shape::Point,
        Shape::Circle { radius: 4 },
        Shape::Rect(3, 7),
    ];

    let mut bucket: Bucket<'_, u64> = Bucket::new(TABLE_NAME);
    for s in &shapes {
        bucket.push(s.area());
    }

    let joined = bucket.render(", ", |v| format!("{v:>4}"));
    let (a, b) = origin_pair();

    println!("{GREETING}, {}!", bucket.label);
    println!("joined = [{joined}] pair = ({a}, {b})");
    println!("{:?} / largest = {:?}", tally(&shapes), largest(&[1.0_f64, 2.5, 0.5]));
    println!("{}", shapes[1]);
    eprintln!("squared: {}", square!(5));

    assert_eq!(MAX_ITEMS, 64);
}
