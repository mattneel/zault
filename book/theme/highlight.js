// Shiki-based syntax highlighting for mdBook
// Provides high-quality Zig syntax highlighting using TextMate grammars

(function shikiHighlighting() {
    let shikiModule;

    window.hljs = {
        configure() {
            shikiModule = import("https://esm.sh/shiki@1.22.2");
        },
        /** @param {HTMLElement} block */
        async highlightBlock(block) {
            const lang = [...block.classList.values()]
                .map((name) => name.match(/^language-(.+)$/)?.[1])
                .filter(Boolean)[0];

            if (!lang) {
                return;
            }

            const shiki = await shikiModule;

            // Map language aliases
            const langMap = {
                'zig': 'zig',
                'bash': 'bash',
                'sh': 'bash',
                'shell': 'bash',
                'json': 'json',
                'yaml': 'yaml',
                'toml': 'toml',
                'markdown': 'markdown',
                'md': 'markdown',
            };

            const mappedLang = langMap[lang.toLowerCase()] || lang;

            try {
                block.parentElement.innerHTML = await shiki.codeToHtml(block.innerText, {
                    lang: mappedLang,
                    themes: {
                        light: 'github-light',
                        dark: 'github-dark',
                    },
                    defaultColor: false,
                });
            } catch (err) {
                // Fallback to plaintext if language not supported
                console.warn(`Shiki: Language '${mappedLang}' not supported, using plaintext`);
                block.parentElement.innerHTML = await shiki.codeToHtml(block.innerText, {
                    lang: 'txt',
                    themes: {
                        light: 'github-light',
                        dark: 'github-dark',
                    },
                    defaultColor: false,
                });
            }
        },
    };
})();
