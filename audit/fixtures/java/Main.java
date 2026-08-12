// Hand-written Java fixture for the JetBrains highlight audit (IC/IU).
// Every construct here exists so a TextAttributesKey gets exercised; keep the
// line numbers stable - audit/jetbrains-expected.json pins expectations to them.
// (default package on purpose: the fixture is configured by text, never compiled)

import java.util.List;
import java.util.function.Function;

/** Utility entry point. */
public class Main {

    private static final int MAX_RETRIES = 3;

    private final String name;

    public Main(String name) {
        this.name = name;
    }

    interface Greeter {
        String greet(String prefix);
    }

    enum Level {
        INFO,
        WARN
    }

    @FunctionalInterface
    interface Transform extends Function<String, String> {
    }

    @Override
    public String toString() {
        return "Main(" + name + ')';
    }

    static <T> List<T> firstOnly(List<T> items) {
        return items.subList(0, 1);
    }

    public String greet(String prefix) {
        char sep = ':';
        double ratio = 1.5;
        Transform upper = value -> value.toUpperCase();
        String msg = prefix + sep + upper.apply(name);
        if (MAX_RETRIES > 0 && ratio > 1.0) {
            return msg + Level.INFO;
        }
        return msg;
    }

    public static void main(String[] args) {
        Main main = new Main("one-dark");
        System.out.println(main.greet("hello"));
    }
}
