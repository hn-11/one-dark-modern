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
 * JSON goes to build/dumps/<fixture>.json; color resolution against our .icls
 * happens in scripts/compare-jetbrains-dump.ts.
 */
public class HighlightDumpTest extends BasePlatformTestCase {

    public void testDumpFixtures() throws Exception {
        String ideType = System.getProperty("audit.ideType", "GO");
        Path fixtures = Paths.get(System.getProperty("audit.fixtures"));
        Path out = Paths.get(System.getProperty("audit.out"));
        Files.createDirectories(out);

        List<Path> files = new ArrayList<>();
        if (ideType.equals("GO")) {
            configureGoSdk(out);
            try (var s = Files.walk(fixtures.resolve("go"))) {
                s.filter(p -> p.toString().endsWith(".go")).forEach(files::add);
            }
        } else { // WS and anything JS-capable
            for (String dir : new String[]{"ts", "js"}) {
                try (var s = Files.walk(fixtures.resolve(dir))) {
                    s.filter(p -> {
                        String n = p.toString();
                        return n.endsWith(".ts") || n.endsWith(".tsx") || n.endsWith(".js") || n.endsWith(".jsx");
                    }).forEach(files::add);
                }
            }
        }
        assertFalse("no fixtures found", files.isEmpty());

        for (Path file : files) {
            String text = Files.readString(file, StandardCharsets.UTF_8);
            myFixture.configureByText(file.getFileName().toString(), text);

            StringBuilder json = new StringBuilder();
            json.append("{\"file\":\"").append(file.getFileName()).append("\",\"tokens\":[");
            boolean first = true;

            // lexer layer
            HighlighterIterator it = ((EditorEx) myFixture.getEditor()).getHighlighter().createIterator(0);
            while (!it.atEnd()) {
                TextAttributesKey[] keys = it.getTextAttributesKeys();
                if (keys != null && keys.length > 0) {
                    first = appendToken(json, first, "lexer", it.getStart(), it.getEnd(), keys, text);
                }
                it.advance();
            }

            // daemon layer (annotators - the "semantic" side of IntelliJ)
            for (HighlightInfo info : myFixture.doHighlighting()) {
                TextAttributesKey key = info.forcedTextAttributesKey != null
                        ? info.forcedTextAttributesKey
                        : (info.type != null ? info.type.getAttributesKey() : null);
                if (key == null) continue;
                first = appendToken(json, first, "daemon", info.getStartOffset(), info.getEndOffset(),
                        new TextAttributesKey[]{key}, text);
            }

            json.append("]}");
            String name = file.getFileName().toString().replaceAll("\\W", "_") + ".json";
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
        // the test VFS guard rejects paths outside the project/home (e.g. CI toolcache);
        // reflective: the class is on the runtime classpath but not always compile-time
        Class.forName("com.intellij.testFramework.VfsRootAccess")
                .getMethod("allowRootAccess", com.intellij.openapi.Disposable.class, String[].class)
                .invoke(null, getTestRootDisposable(), new String[]{goroot});
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

    private static boolean appendToken(StringBuilder json, boolean first, String layer,
                                       int start, int end, TextAttributesKey[] keys, String text) {
        if (end <= start || end > text.length()) return first;
        if (!first) json.append(',');
        String snippet = text.substring(start, Math.min(end, start + 40));
        json.append("{\"layer\":\"").append(layer)
            .append("\",\"start\":").append(start)
            .append(",\"end\":").append(end)
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
