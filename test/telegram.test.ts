import assert from "node:assert/strict";
import test from "node:test";

import {
    chunkTelegramMessage,
    escapeTelegramHtmlText,
    sanitizeTelegramCodeTags,
} from "../src/index.js";

test("escapeTelegramHtmlText escapes unsafe HTML while preserving existing entities", () => {
    assert.equal(
        escapeTelegramHtmlText("A & B < C > D &amp; E &#169; F"),
        "A &amp; B &lt; C &gt; D &amp; E &#169; F",
    );
});

test("sanitizeTelegramCodeTags escapes only code/pre contents", () => {
    assert.equal(
        sanitizeTelegramCodeTags("<b>Keep bold</b> <code>a < b && c</code> <pre>x > y</pre>"),
        "<b>Keep bold</b> <code>a &lt; b &amp;&amp; c</code> <pre>x &gt; y</pre>",
    );
});

test("chunkTelegramMessage splits long messages for Telegram", () => {
    assert.deepEqual(chunkTelegramMessage("abcdef", 2), ["ab", "cd", "ef"]);
    assert.deepEqual(chunkTelegramMessage("", 2), [""]);
});

test("chunkTelegramMessage rejects invalid chunk sizes", () => {
    assert.throws(() => chunkTelegramMessage("hello", 0), /positive finite/);
    assert.throws(() => chunkTelegramMessage("hello", Number.POSITIVE_INFINITY), /positive finite/);
});
