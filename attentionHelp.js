(function () {
    'use strict';
    console.log('Sentence navigation script loaded');

    let shiftHeld = false;
    let sentenceSpans = [];
    let currentIndex = 0;
    let active = false;
    let lastPageText = '';

    const observer = new MutationObserver(() => {
        const popup = document.querySelector('div[id^="cdk-overlay-"].gb-popup');
        if (popup) popup.remove();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') {
            shiftHeld = true;
            if (sentenceSpans[currentIndex]) {
                selectText(sentenceSpans[currentIndex]);
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            shiftHeld = false;
            window.getSelection().removeAllRanges();
        }
    });

    const style = document.createElement('style');
    style.textContent = `
    .focused-sentence {
        background-color: #ffff99;
        border-radius: 4px;
        display: inline;
        box-decoration-break: clone;
    }

    .hide-cursor {
        cursor: none !important;
    }

    #fake-cursor {
        position: fixed;
        width: 8px;
        height: 8px;
        background: transparent;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
    }
`;
    document.head.appendChild(style);


    function autoUpdateSentences() {
        setInterval(() => {
            const bodyText = document.body.innerText.slice(0, 1000);
            if (bodyText !== lastPageText) {
                lastPageText = bodyText;
                document.querySelectorAll('.sentence-nav-span').forEach(el => {
                    const textNode = document.createTextNode(el.textContent);
                    el.replaceWith(textNode);
                });
                sentenceSpans = [];
                splitAndWrapSentences();
            }
        }, 1500);
    }

    function selectText(span) {
        const range = document.createRange();
        range.selectNodeContents(span);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function splitSentencesWithIntl(text) {
        const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
        return Array.from(segmenter.segment(text))
            .map(segment => segment.segment.trim())
            .filter(Boolean);
    }

    function getMergedTextNodes() {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const mergedNodes = [];
        let currentGroup = [];

        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.nodeValue.trim().length > 0 && node.parentNode.nodeName !== "SCRIPT") {
                const isInline = window.getComputedStyle(node.parentNode).display === "inline" ||
                    node.parentNode.tagName === "SPAN" || node.parentNode.tagName === "A";
                if (isInline) {
                    currentGroup.push(node);
                } else {
                    if (currentGroup.length > 0) {
                        mergedNodes.push([...currentGroup]);
                        currentGroup = [];
                    }
                    mergedNodes.push([node]);
                }
            }
        }
        if (currentGroup.length > 0) mergedNodes.push([...currentGroup]);
        return mergedNodes;
    }

    function splitAndWrapSentences() {
        const nodeGroups = getMergedTextNodes();
        sentenceSpans = [];

        for (let group of nodeGroups) {
            const parent = group[0].parentNode;
            const allSameParent = group.every(n => n.parentNode === parent);
            if (!allSameParent) continue;

            const text = group.map(n => n.nodeValue).join(" ");
            const rawSentences = splitSentencesWithIntl(text);
            if (!rawSentences || rawSentences.length === 0) continue;

            const fragment = document.createDocumentFragment();
            rawSentences.forEach((sentence) => {
                const span = document.createElement('span');
                span.textContent = sentence + ' ';
                span.classList.add('sentence-nav-span');
                span.addEventListener('click', () => {
                    currentIndex = sentenceSpans.indexOf(span);
                    highlightSentence(currentIndex);
                });
                fragment.appendChild(span);
                sentenceSpans.push(span);
            });

            parent.insertBefore(fragment, group[group.length - 1].nextSibling);
            group.forEach(n => {
                if (n.parentNode === parent) parent.removeChild(n);
            });
        }

        highlightSentence(0);
        active = true;
    }

    function observeChanges() {
        const targetNode = document.body;
        const observer = new MutationObserver(() => {
            const spansExist = document.querySelector('.sentence-nav-span');
            if (!spansExist) {
                sentenceSpans = [];
                splitAndWrapSentences();
            }
        });
        observer.observe(targetNode, { childList: true, subtree: true });
    }

    function highlightSentence(i) {
        sentenceSpans.forEach(span => span.classList.remove('focused-sentence'));
        if (sentenceSpans[i]) {
            const span = sentenceSpans[i];
            span.classList.add('focused-sentence');
            currentIndex = i;
            if (shiftHeld) selectText(span);
            else window.getSelection().removeAllRanges();
        }
    }

    function hideTooltip() {
    // Simulate moving mouse away from text (offscreen)
    const offX = window.innerWidth - 10;
    const offY = window.innerHeight - 10;
    const el = document.elementFromPoint(offX, offY);

    if (el) {
        el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: offX, clientY: offY }));
        el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, clientX: offX, clientY: offY }));
        el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, clientX: offX, clientY: offY }));
    }

    // Optional: simulate click far away
    el?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: offX, clientY: offY }));
    el?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: offX, clientY: offY }));
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: offX, clientY: offY }));
}

    function simulateHover(x, y) {
        const el = document.elementFromPoint(x, y);
        if (el) {
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
            el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
            el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: x, clientY: y }));
        }
    }

    function simulateFakeCursorHover(span) {
        const range = document.createRange();
        range.selectNodeContents(span);
        const rects = range.getClientRects();
        if (rects.length === 0) return;

        const rect = rects[0];
        const x = rect.left + 10;
        const y = rect.top + 5;

        // Hide real cursor
        document.body.classList.add('hide-cursor');

        let fakeCursor = document.getElementById('fake-cursor');
        if (!fakeCursor) {
            fakeCursor = document.createElement('div');
            fakeCursor.id = 'fake-cursor';
            document.body.appendChild(fakeCursor);
        }

        fakeCursor.style.left = `${x}px`;
        fakeCursor.style.top = `${y}px`;

        simulateHover(x, y);

        setTimeout(() => {
            fakeCursor.remove();
            document.body.classList.remove('hide-cursor');
        }, 1500);
    }

    // Key handler
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'r') {
            splitAndWrapSentences();
            autoUpdateSentences();
            observeChanges();
            return;
        }

        if (!active) return;

        if (e.key === 's') {
            if (currentIndex < sentenceSpans.length - 1) {
                hideTooltip();
                currentIndex++;
                highlightSentence(currentIndex);
            }
            e.preventDefault();
        } else if (e.key === 'w') {
            if (currentIndex > 0) {
                hideTooltip();
                currentIndex--;
                highlightSentence(currentIndex);
            }
            e.preventDefault();
        } else if (e.key === 'd') {
            const span = sentenceSpans[currentIndex];
            if (!span) return;

            const range = document.createRange();
            range.selectNodeContents(span);
            const rects = range.getClientRects();
            if (rects.length === 0) return;

            const rect = rects[0];
            const x = rect.left + 10;
            const y = rect.top + 5;

            // Create or reuse fake cursor
            let fakeCursor = document.getElementById('fake-cursor');
            if (!fakeCursor) {
                fakeCursor = document.createElement('div');
                fakeCursor.id = 'fake-cursor';
                fakeCursor.style.position = 'fixed';
                fakeCursor.style.width = '6px';
                fakeCursor.style.height = '6px';
                fakeCursor.style.borderRadius = '50%';
                fakeCursor.style.background = 'red'; // make visible to debug
                fakeCursor.style.zIndex = '9999';
                fakeCursor.style.pointerEvents = 'none';
                document.body.appendChild(fakeCursor);
            }

            fakeCursor.style.left = `${x}px`;
            fakeCursor.style.top = `${y}px`;

            // Optional: slight scroll nudge to center sentence
            span.scrollIntoView({ block: 'center', behavior: 'instant' });

            const target = document.elementFromPoint(x, y);
            if (target) {
                // Hover events first
                target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
                target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));

                // Give hover a little time before click
                setTimeout(() => {
                    // Then click
                    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
                    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
                    target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));

                    // Now hide real cursor
                    document.body.classList.add('hide-cursor');

                    // Remove fake cursor and restore real cursor
                    setTimeout(() => {
                        if (fakeCursor) fakeCursor.remove();
                        document.body.classList.remove('hide-cursor');
                    }, 1500); // keep it invisible briefly to stabilize tooltip
                }, 150); // short delay to allow hover before click
            }

            e.preventDefault();
        }


    });
})();
