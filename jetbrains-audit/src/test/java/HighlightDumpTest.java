import com.intellij.codeInsight.daemon.impl.HighlightInfo;
import com.intellij.openapi.editor.colors.TextAttributesKey;
import com.intellij.openapi.editor.ex.EditorEx;
import com.intellij.openapi.editor.highlighter.HighlighterIterator;
import com.intellij.testFramework.fixtures.BasePlatformTestCase;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * Dumps, for every token the real IDE produces (lexer layer + daemon/annotator
 * layer), the text range and the TextAttributesKey with its fallback chain.
 * JSON goes to build/dumps/&lt;fixture-relative-path&gt;.json; color resolution
 * against our .icls happens in scripts/compare-jetbrains-dump.ts.
 *
 * Each token carries start/end offsets plus the 1-based line/column of its
 * start, so expectations can be pinned to a position instead of matching by
 * bare token text. Tokens are emitted lexer-layer first, daemon layer second -
 * the compare script relies on that order for "last write wins per range
 * start" (daemon/annotator beats lexer).
 *
 * Dumps are keyed by the path relative to audit/fixtures, not by basename:
 * go/colorize/test.go and go/colorize13777/test.go are different fixtures and
 * used to overwrite each other's test_go.json (last one wins).
 *
 * Fixture discovery is driven by ideType: GO -&gt; audit/fixtures/go,
 * IC/IU -&gt; java, PC/PY -&gt; py, everything else (WS) -&gt; ts + js.
 */
public class HighlightDumpTest extends BasePlatformTestCase {

    public void testDumpFixtures() throws Exception {
        String ideType = System.getProperty("audit.ideType", "GO");
        Path fixtures = Paths.get(System.getProperty("audit.fixtures"));
        Path out = Paths.get(System.getProperty("audit.out"));
        Files.createDirectories(out);

        String[] dirs;
        String[] exts;
        switch (ideType) {
            case "GO" -> {
                dirs = new String[]{"go"};
                exts = new String[]{".go"};
                configureGoSdk(out);
            }
            case "IC", "IU" -> {
                dirs = new String[]{"java"};
                exts = new String[]{".java"};
            }
            case "PC", "PY" -> {
                dirs = new String[]{"py"};
                exts = new String[]{".py"};
            }
            default -> { // WS and anything JS-capable
                dirs = new String[]{"ts", "js"};
                exts = new String[]{".ts", ".tsx", ".js", ".jsx"};
            }
        }

        List<Path> files = new ArrayList<>();
        for (String dir : dirs) {
            Path base = fixtures.resolve(dir);
            if (!Files.isDirectory(base)) continue;
            try (var s = Files.walk(base)) {
                s.filter(p -> {
                    String n = p.toString();
                    for (String ext : exts) if (n.endsWith(ext)) return true;
                    return false;
                }).forEach(files::add);
            }
        }
        Collections.sort(files);
        assertFalse("no fixtures found for ideType=" + ideType, files.isEmpty());

        for (Path file : files) {
            String text = Files.readString(file, StandardCharsets.UTF_8);
            int[] lineStarts = lineStarts(text);
            myFixture.configureByText(file.getFileName().toString(), text);

            // stable, collision-free identity: path relative to audit/fixtures,
            // always with forward slashes (e.g. "go/colorize/test.go")
            String key = fixtures.relativize(file).toString().replace(java.io.File.separatorChar, '/');

            StringBuilder json = new StringBuilder();
            json.append("{\"file\":").append(quote(key)).append(",\"tokens\":[");
            boolean first = true;

            // lexer layer
            HighlighterIterator it = ((EditorEx) myFixture.getEditor()).getHighlighter().createIterator(0);
            while (!it.atEnd()) {
                TextAttributesKey[] keys = it.getTextAttributesKeys();
                if (keys != null && keys.length > 0) {
                    first = appendToken(json, first, "lexer", it.getStart(), it.getEnd(), keys, text, lineStarts);
                }
                it.advance();
            }

            // daemon layer (annotators - the "semantic" side of IntelliJ)
            for (HighlightInfo info : myFixture.doHighlighting()) {
                // not "key": the fixture-relative dump key above already uses that name
                TextAttributesKey attrKey = info.forcedTextAttributesKey != null
                        ? info.forcedTextAttributesKey
                        : (info.type != null ? info.type.getAttributesKey() : null);
                if (attrKey == null) continue;
                first = appendToken(json, first, "daemon", info.getStartOffset(), info.getEndOffset(),
                        new TextAttributesKey[]{attrKey}, text, lineStarts);
            }

            json.append("]}");
            // slashes and dots collapse to underscores: "go/base/main.go" ->
            // "go_base_main_go.json"
            String name = key.replaceAll("\\W", "_") + ".json";
            Files.writeString(out.resolve(name), json.toString(), StandardCharsets.UTF_8);
        }
    }

    /**
     * Configures the Go SDK from -Daudit.goroot (reflection: com.goide.* only
     * exists when running against GoLand, and this class must also compile
     * for the WebStorm run).
     */
    private void configureGoSdk(Path out) throws Exception {
        String goroot = System.getProperty("audit.goroot", "");
        Files.writeString(out.resolve("_sdk.log"), "goroot=" + goroot + "\n");
        if (goroot.isEmpty()) return;
        Class<?> sdkClass = Class.forName("com.goide.sdk.GoSdk");
        Object sdk = sdkClass.getMethod("fromHomePath", String.class).invoke(null, goroot);
        Files.writeString(out.resolve("_sdk.log"),
                "goroot=" + goroot + "\nsdk=" + sdk + " valid=" + sdk.getClass().getMethod("isValid").invoke(sdk)
                        + " version=" + sdk.getClass().getMethod("getVersion").invoke(sdk) + "\n");
        Class<?> svcClass = Class.forName("com.goide.sdk.GoSdkService");
        Object service = svcClass
                .getMethod("getInstance", com.intellij.openapi.project.Project.class)
                .invoke(null, getProject());
        com.intellij.openapi.application.WriteAction.runAndWait(() ->
                svcClass.getMethod("setSdk", sdkClass, boolean.class).invoke(service, sdk, false));
        com.intellij.testFramework.IndexingTestUtil.waitUntilIndexesAreReady(getProject());
        Files.writeString(out.resolve("_sdk.log"), "applied\n", java.nio.file.StandardOpenOption.APPEND);
    }

    /** Offsets of the first character of every line, for offset -> line/column. */
    private static int[] lineStarts(String text) {
        List<Integer> starts = new ArrayList<>();
        starts.add(0);
        for (int i = 0; i < text.length(); i++) if (text.charAt(i) == '\n') starts.add(i + 1);
        int[] a = new int[starts.size()];
        for (int i = 0; i < a.length; i++) a[i] = starts.get(i);
        return a;
    }

    /** 1-based line number of {@code offset}. */
    private static int lineOf(int[] lineStarts, int offset) {
        int i = Arrays.binarySearch(lineStarts, offset);
        return (i >= 0 ? i : -i - 2) + 1;
    }

    private static boolean appendToken(StringBuilder json, boolean first, String layer,
                                       int start, int end, TextAttributesKey[] keys, String text,
                                       int[] lineStarts) {
        if (end <= start || end > text.length()) return first;
        if (!first) json.append(',');
        String snippet = text.substring(start, Math.min(end, start + 40));
        int line = lineOf(lineStarts, start);
        json.append("{\"layer\":\"").append(layer)
            .append("\",\"start\":").append(start)
            .append(",\"end\":").append(end)
            .append(",\"line\":").append(line)
            .append(",\"col\":").append(start - lineStarts[line - 1] + 1)
            .append(",\"text\":").append(quote(snippet))
            .append(",\"keys\":[");
        for (int i = 0; i < keys.length; i++) {
            if (i > 0) json.append(',');
            json.append('[');
            TextAttributesKey k = keys[i];
            boolean kFirst = true;
            // key + fallback chain, e.g. ["GO_METHOD_RECEIVER","DEFAULT_PARAMETER","DEFAULT_IDENTIFIER"]
            Set<String> seen = new LinkedHashSet<>();
            while (k != null && seen.add(k.getExternalName())) {
                if (!kFirst) json.append(',');
                json.append(quote(k.getExternalName()));
                kFirst = false;
                k = k.getFallbackAttributeKey();
            }
            json.append(']');
        }
        json.append("]}");
        return false;
    }

    private static String quote(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                case '\t' -> b.append("\\t");
                default -> {
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
                }
            }
        }
        return b.append('"').toString();
    }
}
