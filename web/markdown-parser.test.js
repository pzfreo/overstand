/**
 * Tests for markdown-parser.js
 *
 * The markdownToHtml function converts a subset of markdown
 * (headers, bold, links, lists, paragraphs, version lines)
 * into HTML for the about dialog.
 */

import { markdownToHtml } from './markdown-parser.js';

describe('markdownToHtml', () => {
    test('wraps output in about-content div', () => {
        const result = markdownToHtml('hello');
        expect(result).toMatch(/^<div class="about-content">.*<\/div>$/s);
    });

    // ---- Headers ----

    test('converts # bold header to h1', () => {
        const result = markdownToHtml('# **My Title**');
        expect(result).toContain('<h1 class="about-title">My Title</h1>');
    });

    test('converts # plain header to h1', () => {
        const result = markdownToHtml('# Plain Title');
        expect(result).toContain('<h1 class="about-title">Plain Title</h1>');
    });

    test('converts ## header to h3 subtitle', () => {
        const result = markdownToHtml('## Section');
        expect(result).toContain('<h3 class="about-subtitle">Section</h3>');
    });

    // ---- Bold ----

    test('converts **bold** text', () => {
        const result = markdownToHtml('This is **bold** text');
        expect(result).toContain('<strong>bold</strong>');
    });

    // ---- Links ----

    test('converts emoji links with target _blank', () => {
        const result = markdownToHtml('[🌐 Website](https://example.com)');
        expect(result).toContain('<a href="https://example.com" target="_blank" class="about-link">🌐 Website</a>');
    });

    test('converts mailto links', () => {
        const result = markdownToHtml('[Contact](mailto:test@example.com)');
        expect(result).toContain('<a href="mailto:test@example.com" class="about-email">Contact</a>');
    });

    test('converts regular links with target _blank', () => {
        const result = markdownToHtml('[Click here](https://example.com)');
        expect(result).toContain('<a href="https://example.com" target="_blank">Click here</a>');
    });

    // ---- Lists ----

    test('converts bullet list items (•)', () => {
        const result = markdownToHtml('• Item one\n• Item two');
        expect(result).toContain('<ul class="about-list">');
        expect(result).toContain('<li>Item one</li>');
        expect(result).toContain('<li>Item two</li>');
        expect(result).toContain('</ul>');
    });

    test('converts dash list items (-)', () => {
        const result = markdownToHtml('- First\n- Second');
        expect(result).toContain('<li>First</li>');
        expect(result).toContain('<li>Second</li>');
    });

    test('closes list before non-list content', () => {
        const result = markdownToHtml('- Item\n\nParagraph after');
        expect(result).toContain('</ul>');
        expect(result).toContain('<p class="about-text">Paragraph after</p>');
        // The </ul> should come before the paragraph
        const ulClose = result.indexOf('</ul>');
        const para = result.indexOf('<p class="about-text">Paragraph after</p>');
        expect(ulClose).toBeLessThan(para);
    });

    // ---- Paragraphs ----

    test('wraps plain text in paragraph tags', () => {
        const result = markdownToHtml('Just some text');
        expect(result).toContain('<p class="about-text">Just some text</p>');
    });

    test('joins consecutive lines into a single paragraph', () => {
        const result = markdownToHtml('Line one\nLine two');
        expect(result).toContain('<p class="about-text">Line one Line two</p>');
    });

    test('separates paragraphs on blank lines', () => {
        const result = markdownToHtml('Para one\n\nPara two');
        expect(result).toContain('<p class="about-text">Para one</p>');
        expect(result).toContain('<p class="about-text">Para two</p>');
    });

    // ---- Version line ----

    test('converts Version: line to version span', () => {
        const result = markdownToHtml('Version: 1.2.3');
        expect(result).toContain('<div class="about-version-container">');
        expect(result).toContain('<span class="about-version">Version 1.2.3</span>');
    });

    // ---- Escape sequences ----

    test('unescapes \\! to !', () => {
        const result = markdownToHtml('Hello\\!');
        expect(result).toContain('Hello!');
        expect(result).not.toContain('\\!');
    });

    test('unescapes \\* to *', () => {
        const result = markdownToHtml('5 \\* 3');
        expect(result).toContain('5 * 3');
    });

    // ---- Mixed content ----

    test('handles a realistic about page', () => {
        const md = `# **Overstand**

Version: 2.0.0

A parametric CAD tool for lutherie.

## Links

[🌐 Website](https://example.com)
[Contact Us](mailto:test@test.com)

## Features

- Feature one
- Feature two

Built with **love**.`;

        const result = markdownToHtml(md);

        expect(result).toContain('<h1 class="about-title">Overstand</h1>');
        expect(result).toContain('<span class="about-version">Version 2.0.0</span>');
        expect(result).toContain('<p class="about-text">A parametric CAD tool for lutherie.</p>');
        expect(result).toContain('<h3 class="about-subtitle">Links</h3>');
        expect(result).toContain('class="about-link"');
        expect(result).toContain('class="about-email"');
        expect(result).toContain('<h3 class="about-subtitle">Features</h3>');
        expect(result).toContain('<li>Feature one</li>');
        expect(result).toContain('<strong>love</strong>');
    });
});
