/**
 * Simple Markdown to HTML Converter
 *
 * Converts a subset of markdown to HTML for the about dialog.
 * Supports: headers, bold, links, lists, and paragraphs.
 */

/**
 * Convert markdown text to HTML
 * @param {string} markdown - The markdown text to convert
 * @returns {string} The converted HTML
 */
export function markdownToHtml(markdown) {
    let html = markdown;

    // Unescape characters
    html = html.replace(/\\!/g, '!');
    html = html.replace(/\\\*/g, '*');

    // Convert headers
    html = html.replace(/^# \*\*(.*?)\*\*/gm, '<h1 class="about-title">$1</h1>');
    html = html.replace(/^# (.*?)$/gm, '<h1 class="about-title">$1</h1>');
    html = html.replace(/^## (.*?)$/gm, '<h3 class="about-subtitle">$1</h3>');

    // Convert bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert links with emoji/icon
    html = html.replace(/\[(🌐|💻|📧)\s*(.*?)\]\((.*?)\)/g, '<a href="$3" target="_blank" class="about-link">$1 $2</a>');

    // Convert email links
    html = html.replace(/\[(.*?)\]\(mailto:(.*?)\)/g, '<a href="mailto:$2" class="about-email">$1</a>');

    // Convert regular links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Split into lines for processing
    const lines = html.split('\n');
    const output = [];
    let inList = false;
    let currentParagraph = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) {
            // Empty line - close any open paragraph or list
            if (currentParagraph.length > 0) {
                output.push('<p class="about-text">' + currentParagraph.join(' ') + '</p>');
                currentParagraph = [];
            }
            if (inList) {
                output.push('</ul>');
                inList = false;
            }
            continue;
        }

        // Check if it's a header or link line (already processed)
        if (line.startsWith('<h1') || line.startsWith('<h3') || line.startsWith('<a href') || line.match(/^Version:/)) {
            // Close any open paragraph
            if (currentParagraph.length > 0) {
                output.push('<p class="about-text">' + currentParagraph.join(' ') + '</p>');
                currentParagraph = [];
            }
            if (inList) {
                output.push('</ul>');
                inList = false;
            }

            // Handle version line specially
            if (line.match(/^Version:/)) {
                output.push('<div class="about-version-container">' + line.replace(/Version:\s*(.+)/, '<span class="about-version">Version $1</span>') + '</div>');
            } else {
                output.push(line);
            }
            continue;
        }

        // Check if it's a list item
        if (line.startsWith('•') || line.startsWith('-')) {
            // Close any open paragraph
            if (currentParagraph.length > 0) {
                output.push('<p class="about-text">' + currentParagraph.join(' ') + '</p>');
                currentParagraph = [];
            }

            if (!inList) {
                output.push('<ul class="about-list">');
                inList = true;
            }
            const itemText = line.replace(/^[•\-]\s*/, '');
            output.push('<li>' + itemText + '</li>');
            continue;
        }

        // Regular text line - add to current paragraph
        if (inList) {
            output.push('</ul>');
            inList = false;
        }
        currentParagraph.push(line);
    }

    // Close any remaining open paragraph or list
    if (currentParagraph.length > 0) {
        output.push('<p class="about-text">' + currentParagraph.join(' ') + '</p>');
    }
    if (inList) {
        output.push('</ul>');
    }

    return '<div class="about-content">' + output.join('\n') + '</div>';
}
