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
        if (e.key === 'Shift') shiftHeld = true;
        if (sentenceSpans[currentIndex]) {
            selectText(sentenceSpans[currentIndex]);
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
            padding: 2px;
            border-radius: 4px;
        }
    `;
    style.textContent += `
        #fake-cursor {
            transition: opacity 0.2s;
        }
        .hide-cursor {
            cursor: none !important;
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

        if (currentGroup.length > 0) {
            mergedNodes.push([...currentGroup]);
        }

        return mergedNodes;
    }

    function splitAndWrapSentences() {
        const nodeGroups = getMergedTextNodes();
        sentenceSpans = [];

        for (let group of nodeGroups) {
            const parent = group[0].parentNode;
            const allSameParent = group.every(n => n.parentNode === parent);
            if (!allSameParent) {
                console.warn("Skipped group with mixed parents", group);
                continue;
            }

            const text = group.map(n => n.nodeValue).join(" ");
            const rawSentences = splitSentencesWithIntl(text);
            if (!rawSentences || rawSentences.length === 0) continue;

            const fragment = document.createDocumentFragment();
            rawSentences.forEach((rawSentence) => {
                let sentence = rawSentence;
                if (!sentence) return;

                const span = document.createElement('span');
                span.textContent = sentence + ' ';
                span.classList.add('sentence-nav-span');

                span.addEventListener('click', () => {
                    currentIndex = sentenceSpans.indexOf(span);
                    highlightSentence(currentIndex);
                });

                fragment.appendChild(span);
                sentenceSpans.push(span);
                span.dataset.index = sentenceSpans.length - 1;
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
        const targetNode = document.querySelector('body');
        if (!targetNode) return;

        const observer = new MutationObserver((mutationsList, observer) => {
            const spansExist = document.querySelector('.sentence-nav-span');
            if (!spansExist) {
                sentenceSpans = [];
                splitAndWrapSentences();
            }
        });

        observer.observe(targetNode, {
            childList: true,
            subtree: true
        });
    }

    function clickInCenter() {
        const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        if (el) {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
    }

    function highlightSentence(i) {
        sentenceSpans.forEach(span => span.classList.remove('focused-sentence'));

        if (sentenceSpans[i]) {
            const span = sentenceSpans[i];
            span.classList.add('focused-sentence');
            // span.scrollIntoView({ behavior: 'smooth', block: 'center' });

            if (shiftHeld) {
                selectText(span);
            } else {
                window.getSelection().removeAllRanges();
            }
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') {
            shiftHeld = true;
            if (sentenceSpans[currentIndex]) {
                selectText(sentenceSpans[currentIndex]);
            }
            return;
        }

        // Activation shortcut (always runs)
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'r') {
            splitAndWrapSentences();
            autoUpdateSentences();
            observeChanges();
            return;
        }

        // These only run if active
        if (!active) return;

        if (e.key === 's') {
            if (currentIndex < sentenceSpans.length - 1) {
                currentIndex++;
                highlightSentence(currentIndex);
                // Simulate click in empty space to hide tooltip
                setTimeout(() => {
                    const emptyX = window.innerWidth - 10;
                    const emptyY = window.innerHeight - 10;
                    const el = document.elementFromPoint(emptyX, emptyY);
                    if (el) {
                        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: emptyX, clientY: emptyY }));
                        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: emptyX, clientY: emptyY }));
                        el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: emptyX, clientY: emptyY }));
                    }
                }, 100);

                clickInCenter();
            }
            e.preventDefault();
        } else if (e.key === 'w') {
            if (currentIndex > 0) {
                currentIndex--;
                highlightSentence(currentIndex);
                // Simulate click in empty space to hide tooltip
                setTimeout(() => {
                    const emptyX = window.innerWidth - 10;
                    const emptyY = window.innerHeight - 10;
                    const el = document.elementFromPoint(emptyX, emptyY);
                    if (el) {
                        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: emptyX, clientY: emptyY }));
                        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: emptyX, clientY: emptyY }));
                        el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: emptyX, clientY: emptyY }));
                    }
                }, 100);

                clickInCenter();
            }
            e.preventDefault();
        } else if (e.key === 'd') {
            const span = sentenceSpans[currentIndex];
            if (span) {
                span.scrollIntoView({ behavior: 'instant', block: 'center' });

                setTimeout(() => {
                    const range = document.createRange();
                    range.selectNodeContents(span);
                    const rects = range.getClientRects();

                    if (rects.length > 0) {
                        const rect = rects[0];
                        const x = rect.left + 10;
                        const y = rect.top + 5;

                        // Hide the real cursor
                        document.body.classList.add('hide-cursor');

                        // Create or reuse fake cursor
                        let fakeCursor = document.getElementById('fake-cursor');
                        if (!fakeCursor) {
                            fakeCursor = document.createElement('div');
                            fakeCursor.id = 'fake-cursor';
                            fakeCursor.style.position = 'fixed';
                            fakeCursor.style.width = '8px';
                            fakeCursor.style.height = '8px';
                            fakeCursor.style.borderRadius = '50%';
                            fakeCursor.style.background = 'transparent'; // make invisible
                            fakeCursor.style.pointerEvents = 'none';
                            fakeCursor.style.zIndex = '9999';
                            document.body.appendChild(fakeCursor);
                        }

                        fakeCursor.style.left = `${x}px`;
                        fakeCursor.style.top = `${y}px`;

                        const el = document.elementFromPoint(x, y);
                        if (el) {
                            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
                            el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
                            el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: x, clientY: y }));
                        }

                        setTimeout(() => {
                            if (fakeCursor) fakeCursor.remove();
                            document.body.classList.remove('hide-cursor');
                        }, 2000);
                    }
                }, 100); // slight delay to allow rendering
            }
            e.preventDefault();
        }

    });

})();
