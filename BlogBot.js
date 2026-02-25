// 加载外部 CSS 文件
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'BlogBot.css';  // 请根据实际情况修改路径
link.type = 'text/css';
link.onload = () => console.log('[CSS] 外部样式加载成功');
link.onerror = () => console.warn('[CSS] 外部样式加载失败，使用内联样式');
document.head.appendChild(link);

// 加载 Hammersmith One 字体
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Hammersmith+One&family=Source+Sans+Pro:wght@400;600&display=swap';
document.head.appendChild(fontLink);

document.addEventListener('DOMContentLoaded', () => {
    // 获取当前执行的script标签
    const currentScript = document.currentScript || 
      document.querySelector('script[src*="BlogBot.js"]');
    
    // 从data属性读取安全参数
    const config = {
      AUTH_API_URL: currentScript.dataset.authApiUrl
    };
  
    // 使用配置参数
    const CHAT_ICON_SVG = 'taomei_icon_120px.webp';
    
    // 机器人信息（将从app.js获取）
    let botInfo = {
      qq: null,
      name: null
    };
    
    // 全局状态
    let isAdminMode = false;
    let authToken = localStorage.getItem('auth_token');
    let userToken = localStorage.getItem('user_token');
    let currentUserId = localStorage.getItem('user_id');
    let currentAvatar = null;
    try {
        currentAvatar = JSON.parse(localStorage.getItem('user_avatar') || 'null');
    } catch (e) {
        currentAvatar = null;
    }
    let browserFingerprint = null;
    let isInitialized = false;
    let currentMasterQQ = null;
    let welcomeMessageShown = false;
    const messageHistory = new Map();
    
    const CHAT_HISTORY_CONFIG = {
        maxHistoryMessages: 10,
        storageKey: 'BlogBot_history',
        maxStorageUsers: 5
    };

    // ==================== GLightbox相关变量 ====================
    let glightboxInstance = null;
    let isGlightboxLoading = false;
    let glightboxLoaded = false;

    // ==================== GLightbox动态加载 ====================
    
    /**
     * 动态加载GLightbox库（CSS + JS）
     */
    function loadGLightbox() {
        return new Promise((resolve, reject) => {
            // 检查是否已加载
            if (typeof GLightbox !== 'undefined') {
                console.log('[GLIGHTBOX] 已存在');
                glightboxLoaded = true;
                resolve();
                return;
            }

            if (isGlightboxLoading) {
                // 等待加载完成
                const checkInterval = setInterval(() => {
                    if (glightboxLoaded) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
                
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (!glightboxLoaded) {
                        reject(new Error('GLightbox加载超时'));
                    }
                }, 10000);
                return;
            }

            isGlightboxLoading = true;
            console.log('[GLIGHTBOX] 开始加载...');

            // CDN列表
            const cdnUrls = [
                {
                    css: 'https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/css/glightbox.min.css',
                    js: 'https://cdn.jsdelivr.net/npm/glightbox@3.2.0/dist/js/glightbox.min.js'
                },
                {
                    css: 'https://unpkg.com/glightbox@3.2.0/dist/css/glightbox.min.css',
                    js: 'https://unpkg.com/glightbox@3.2.0/dist/js/glightbox.min.js'
                },
                {
                    css: 'https://cdnjs.cloudflare.com/ajax/libs/glightbox/3.2.0/css/glightbox.min.css',
                    js: 'https://cdnjs.cloudflare.com/ajax/libs/glightbox/3.2.0/js/glightbox.min.js'
                }
            ];

            let currentIndex = 0;

            function tryLoadFromCdn() {
                if (currentIndex >= cdnUrls.length) {
                    console.error('[GLIGHTBOX] 所有CDN加载失败');
                    isGlightboxLoading = false;
                    reject(new Error('Failed to load GLightbox from all CDNs'));
                    return;
                }

                const cdn = cdnUrls[currentIndex];
                console.log('[GLIGHTBOX] 尝试加载:', cdn.js);

                // 加载CSS
                const existingLink = document.querySelector('link[href*="glightbox"]');
                if (!existingLink) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = cdn.css;
                    document.head.appendChild(link);
                }

                // 加载JS
                const script = document.createElement('script');
                script.src = cdn.js;
                script.onload = () => {
                    console.log('[GLIGHTBOX] 加载成功');
                    glightboxLoaded = true;
                    isGlightboxLoading = false;
                    resolve();
                };
                script.onerror = () => {
                    console.warn('[GLIGHTBOX] CDN加载失败:', cdn.js);
                    currentIndex++;
                    tryLoadFromCdn();
                };
                document.head.appendChild(script);
            }

            tryLoadFromCdn();
        });
    }

    // 在页面加载时预加载GLightbox
    loadGLightbox().catch(e => console.warn('[GLIGHTBOX] 预加载失败:', e));

    // ==================== JsBarcode相关变量 ====================
    let isJsBarcodeLoading = false;
    let jsBarcodeLoaded = false;

    // ==================== JsBarcode动态加载 ====================
    
    /**
     * 动态加载JsBarcode库
     */
    function loadJsBarcode() {
        return new Promise((resolve, reject) => {
            if (typeof JsBarcode !== 'undefined') {
                console.log('[JSBARCODE] 已存在');
                jsBarcodeLoaded = true;
                resolve();
                return;
            }

            if (isJsBarcodeLoading) {
                const checkInterval = setInterval(() => {
                    if (jsBarcodeLoaded) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
                
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (!jsBarcodeLoaded) {
                        reject(new Error('JsBarcode加载超时'));
                    }
                }, 10000);
                return;
            }

            isJsBarcodeLoading = true;
            console.log('[JSBARCODE] 开始加载...');

            const cdnUrls = [
                'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
                'https://unpkg.com/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js'
            ];

            let currentIndex = 0;

            function tryLoadFromCdn() {
                if (currentIndex >= cdnUrls.length) {
                    console.error('[JSBARCODE] 所有CDN加载失败');
                    isJsBarcodeLoading = false;
                    reject(new Error('Failed to load JsBarcode from all CDNs'));
                    return;
                }

                const script = document.createElement('script');
                script.src = cdnUrls[currentIndex];
                console.log('[JSBARCODE] 尝试加载:', cdnUrls[currentIndex]);
                
                script.onload = () => {
                    console.log('[JSBARCODE] 加载成功');
                    jsBarcodeLoaded = true;
                    isJsBarcodeLoading = false;
                    resolve();
                };
                
                script.onerror = () => {
                    console.warn('[JSBARCODE] CDN加载失败:', cdnUrls[currentIndex]);
                    currentIndex++;
                    tryLoadFromCdn();
                };
                
                document.head.appendChild(script);
            }

            tryLoadFromCdn();
        });
    }

    /**
     * 生成渐变条形码SVG - 使用mask实现条形码本身的渐变
     * @param {string} text - 条形码内容
     * @param {HTMLElement} container - 容器元素
     */
    async function generateGradientBarcode(text, container) {
        try {
            await loadJsBarcode();
            
            // 创建临时SVG元素让JsBarcode生成
            const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            
            // 使用JsBarcode生成条形码到SVG
            JsBarcode(tempSvg, text, {
                format: "CODE128",
                width: 4,
                height: 100,
                displayValue: false,
                background: "transparent",
                margin: 0
            });
            
            // 获取原始条形码的rect元素
            const rects = tempSvg.querySelectorAll('rect');
            if (rects.length === 0) {
                throw new Error('No barcode rects generated');
            }
            
            // 获取原始尺寸
            const originalWidth = parseFloat(tempSvg.getAttribute('width') || '100');
            const originalHeight = parseFloat(tempSvg.getAttribute('height') || '100');
            
            // 目标尺寸
            const targetWidth = 140;
            const targetHeight = 35;
            const scale = targetWidth / originalWidth;
            
            // 创建新的SVG
            const svgNS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(svgNS, "svg");
            svg.setAttribute("width", targetWidth.toString());
            svg.setAttribute("height", targetHeight.toString());
            svg.setAttribute("viewBox", `0 0 ${targetWidth} ${targetHeight}`);
            
            // 创建defs
            const defs = document.createElementNS(svgNS, "defs");
            
            // 创建唯一ID
            const uniqueId = `barcode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // 创建渐变
            const linearGradient = document.createElementNS(svgNS, "linearGradient");
            linearGradient.setAttribute("id", `gradient_${uniqueId}`);
            linearGradient.setAttribute("x1", "0%");
            linearGradient.setAttribute("y1", "0%");
            linearGradient.setAttribute("x2", "100%");
            linearGradient.setAttribute("y2", "0%");
            
            const stop1 = document.createElementNS(svgNS, "stop");
            stop1.setAttribute("offset", "0%");
            stop1.setAttribute("stop-color", "#333333");
            
            const stop2 = document.createElementNS(svgNS, "stop");
            stop2.setAttribute("offset", "100%");
            stop2.setAttribute("stop-color", "#8746F8");
            
            linearGradient.appendChild(stop1);
            linearGradient.appendChild(stop2);
            defs.appendChild(linearGradient);
            
            // 创建mask
            const mask = document.createElementNS(svgNS, "mask");
            mask.setAttribute("id", `mask_${uniqueId}`);
            
            // 将条形码的rect复制到mask中（白色表示可见区域）
            // 过滤掉背景rect（通常为白色或第一个rect）
            rects.forEach((rect, index) => {
                // 检查是否是背景（白色填充）或者是第一个rect（很可能是背景）
                const fill = rect.getAttribute('fill') || 'black';
                const isLikelyBackground = (fill.toLowerCase() === 'white' || fill.toLowerCase() === '#ffffff') || index === 0;
                
                if (!isLikelyBackground) {
                    const maskRect = document.createElementNS(svgNS, "rect");
                    const x = parseFloat(rect.getAttribute('x') || '0') * scale;
                    const width = parseFloat(rect.getAttribute('width') || '0') * scale;
                    maskRect.setAttribute("x", x.toString());
                    maskRect.setAttribute("y", "0");
                    maskRect.setAttribute("width", width.toString());
                    maskRect.setAttribute("height", targetHeight.toString());
                    maskRect.setAttribute("fill", "white");
                    mask.appendChild(maskRect);
                }
            });
            
            defs.appendChild(mask);
            svg.appendChild(defs);
            
            // 创建渐变填充矩形，应用mask
            const gradientRect = document.createElementNS(svgNS, "rect");
            gradientRect.setAttribute("x", "0");
            gradientRect.setAttribute("y", "0");
            gradientRect.setAttribute("width", targetWidth.toString());
            gradientRect.setAttribute("height", targetHeight.toString());
            gradientRect.setAttribute("fill", `url(#gradient_${uniqueId})`);
            gradientRect.setAttribute("mask", `url(#mask_${uniqueId})`);
            svg.appendChild(gradientRect);
            
            container.innerHTML = '';
            container.appendChild(svg);
            
            console.log('[JSBARCODE] 条形码生成成功(mask方式):', text);
        } catch (error) {
            console.error('[JSBARCODE] 条形码生成失败:', error);
            // 使用备用方案：显示文本
            container.innerHTML = `<span style="font-size: 9px; color: #333;">${text}</span>`;
        }
    }

    // ==================== Markdown渲染相关变量 ====================
    let isMarkedLoading = false;
    let isHighlightLoading = false;
    let markedLoaded = false;
    let highlightLoaded = false;

    // ==================== Markdown渲染相关函数 ====================

    /**
     * 动态加载Marked.js库
     */
    function loadMarked() {
        return new Promise((resolve, reject) => {
            // 检查是否已加载
            if (typeof marked !== 'undefined' && (marked.parse || typeof marked === 'function')) {
                console.log('[MARKDOWN] Marked已存在');
                markedLoaded = true;
                configureMarked();
                resolve();
                return;
            }

            if (isMarkedLoading) {
                // 等待加载完成
                const checkInterval = setInterval(() => {
                    if (markedLoaded) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
                
                // 超时处理
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (!markedLoaded) {
                        reject(new Error('Marked加载超时'));
                    }
                }, 10000);
                return;
            }

            isMarkedLoading = true;
            
            // 尝试多个CDN
            const cdnUrls = [
                'https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js',
                'https://unpkg.com/marked@4.3.0/marked.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js'
            ];
            
            let currentIndex = 0;
            
            function tryLoadFromCdn() {
                if (currentIndex >= cdnUrls.length) {
                    console.error('[MARKDOWN] 所有CDN加载失败');
                    isMarkedLoading = false;
                    reject(new Error('Failed to load marked.js from all CDNs'));
                    return;
                }
                
                const script = document.createElement('script');
                script.src = cdnUrls[currentIndex];
                console.log('[MARKDOWN] 尝试加载:', cdnUrls[currentIndex]);
                
                script.onload = () => {
                    console.log('[MARKDOWN] Marked.js加载成功');
                    console.log('[MARKDOWN] marked对象:', typeof marked, marked ? Object.keys(marked) : 'undefined');
                    markedLoaded = true;
                    isMarkedLoading = false;
                    configureMarked();
                    resolve();
                };
                
                script.onerror = () => {
                    console.warn('[MARKDOWN] CDN加载失败:', cdnUrls[currentIndex]);
                    currentIndex++;
                    tryLoadFromCdn();
                };
                
                document.head.appendChild(script);
            }
            
            tryLoadFromCdn();
        });
    }

    /**
     * 动态加载Highlight.js库（用于代码高亮）
     */
    function loadHighlight() {
        return new Promise((resolve, reject) => {
            if (typeof hljs !== 'undefined') {
                highlightLoaded = true;
                resolve();
                return;
            }

            if (isHighlightLoading) {
                const checkInterval = setInterval(() => {
                    if (highlightLoaded) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
                return;
            }

            isHighlightLoading = true;

            // 加载CSS
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github.min.css';
            document.head.appendChild(link);

            // 加载JS
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/highlight.js@11/lib/core.min.js';
            script.onload = () => {
                // 加载常用语言
                const languages = [
                    'javascript', 'python', 'java', 'cpp', 'csharp', 
                    'php', 'ruby', 'go', 'rust', 'sql', 'bash', 
                    'json', 'xml', 'css', 'markdown', 'yaml'
                ];
                
                let loadedCount = 0;
                const totalLanguages = languages.length;

                languages.forEach(lang => {
                    const langScript = document.createElement('script');
                    langScript.src = `https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/${lang}.min.js`;
                    langScript.onload = () => {
                        loadedCount++;
                        if (loadedCount === totalLanguages) {
                            console.log('[MARKDOWN] Highlight.js及语言包加载完成');
                            highlightLoaded = true;
                            isHighlightLoading = false;
                            resolve();
                        }
                    };
                    langScript.onerror = () => {
                        loadedCount++;
                        console.warn(`[MARKDOWN] 语言包 ${lang} 加载失败`);
                        if (loadedCount === totalLanguages) {
                            highlightLoaded = true;
                            isHighlightLoading = false;
                            resolve();
                        }
                    };
                    document.head.appendChild(langScript);
                });
            };
            script.onerror = () => {
                console.error('[MARKDOWN] Highlight.js加载失败');
                isHighlightLoading = false;
                reject(new Error('Failed to load highlight.js'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * 配置Marked.js选项
     */
    function configureMarked() {
        if (typeof marked === 'undefined' || !marked.parse) {
            console.warn('[MARKDOWN] Marked未正确加载');
            return;
        }

        try {
            // 新版marked使用marked.use()配置
            if (typeof marked.use === 'function') {
                marked.use({
                    gfm: true,
                    breaks: true,
                    pedantic: false,
                    mangle: false,
                    headerIds: false
                });
            } else {
                // 旧版兼容
                marked.setOptions({
                    gfm: true,
                    breaks: true,
                    pedantic: false,
                    sanitize: false,
                    smartLists: true,
                    smartypants: false
                });
            }
            console.log('[MARKDOWN] Marked.js配置完成');
        } catch (e) {
            console.warn('[MARKDOWN] Marked配置失败:', e);
        }
    }

    /**
     * 检测内容是否包含Markdown格式
     */
    function detectMarkdown(text) {
        if (!text || typeof text !== 'string') {
            console.log('[MARKDOWN] 检测失败: 无效文本');
            return false;
        }

        // Markdown特征检测正则表达式
        const markdownPatterns = [
            { pattern: /^#{1,6}\s+.+$/m, name: '标题' },
            { pattern: /\*\*[^*]+\*\*/, name: '粗体**' },
            { pattern: /\*[^*\s][^*]*\*/, name: '斜体*' },
            { pattern: /__[^_]+__/, name: '粗体__' },
            { pattern: /_[^_\s][^_]*_/, name: '斜体_' },
            { pattern: /~~[^~]+~~/, name: '删除线' },
            { pattern: /`[^`]+`/, name: '行内代码' },
            { pattern: /```[\s\S]*?```/, name: '代码块' },
            { pattern: /^\s*[-*+]\s+.+$/m, name: '无序列表' },
            { pattern: /^\s*\d+\.\s+.+$/m, name: '有序列表' },
            { pattern: /^\s*>\s*.+$/m, name: '引用' },
            { pattern: /\[([^\]]+)\]\(([^)]+)\)/, name: '链接' },
            { pattern: /!\[([^\]]*?)\]\(([^)]+)\)/, name: '图片' },
            { pattern: /^\s*\|.+\|.+\|\s*$/m, name: '表格' },
            { pattern: /^\s*[-*_]{3,}\s*$/m, name: '分割线' },
        ];

        // 检测是否匹配任何Markdown模式
        for (const { pattern, name } of markdownPatterns) {
            if (pattern.test(text)) {
                console.log('[MARKDOWN] 检测到Markdown特征:', name);
                return true;
            }
        }

        console.log('[MARKDOWN] 未检测到Markdown特征');
        return false;
    }

    /**
     * 渲染Markdown内容
     */
    async function renderMarkdown(text) {
        if (!text) return text;
    
        try {
            // 确保Marked已加载
            console.log('[MARKDOWN] 开始加载Marked库...');
            await loadMarked();
            console.log('[MARKDOWN] Marked库加载完成');
                
            // 尝试加载Highlight.js（非阻塞）
            loadHighlight().catch(() => {});
    
            // 检查marked是否可用
            if (typeof marked === 'undefined') {
                console.error('[MARKDOWN] marked未定义');
                return escapeHtml(text);
            }
    
            console.log('[MARKDOWN] marked类型:', typeof marked);
            console.log('[MARKDOWN] marked.parse类型:', typeof marked.parse);
    
            // 使用marked渲染
            let rendered;
                
            // 兼容不同版本API
            if (typeof marked.parse === 'function') {
                console.log('[MARKDOWN] 使用 marked.parse()');
                rendered = marked.parse(text);
            } else if (typeof marked === 'function') {
                console.log('[MARKDOWN] 使用 marked()');
                rendered = marked(text);
            } else if (marked.marked && typeof marked.marked === 'function') {
                console.log('[MARKDOWN] 使用 marked.marked()');
                rendered = marked.marked(text);
            } else {
                console.error('[MARKDOWN] 无法找到marked解析函数');
                console.log('[MARKDOWN] marked对象属性:', Object.keys(marked));
                return escapeHtml(text);
            }
                
            console.log('[MARKDOWN] 渲染完成，结果长度:', rendered ? rendered.length : 0);
            return rendered;
        } catch (error) {
            console.error('[MARKDOWN] 渲染失败:', error);
            return escapeHtml(text);
        }
    }

    /**
     * HTML转义（用于非Markdown内容）
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 处理渲染后的代码块高亮
     */
    function highlightCodeBlocks(container) {
        if (typeof hljs === 'undefined') return;

        const codeBlocks = container.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            // 如果还没有高亮过
            if (!block.classList.contains('hljs')) {
                hljs.highlightElement(block);
            }
        });
    }

    /**
     * 为Markdown内容添加复制代码按钮
     */
    function addCopyButtons(container) {
        const codeBlocks = container.querySelectorAll('pre');
        codeBlocks.forEach(pre => {
            // 检查是否已经添加过复制按钮
            if (pre.querySelector('.code-copy-btn')) return;

            const copyBtn = document.createElement('button');
            copyBtn.className = 'code-copy-btn';
            copyBtn.textContent = '复制';
            copyBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const code = pre.querySelector('code');
                if (code) {
                    try {
                        await navigator.clipboard.writeText(code.textContent);
                        copyBtn.textContent = '已复制!';
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            copyBtn.textContent = '复制';
                            copyBtn.classList.remove('copied');
                        }, 2000);
                    } catch (err) {
                        console.error('[MARKDOWN] 复制失败:', err);
                        copyBtn.textContent = '失败';
                        setTimeout(() => {
                            copyBtn.textContent = '复制';
                        }, 2000);
                    }
                }
            });
            pre.appendChild(copyBtn);
        });
    }

    // ==================== GLightbox相关函数 ====================

    /**
     * 初始化GLightbox
     */
    async function initGLightbox() {
        // 等待DOM更新后再初始化
        setTimeout(async () => {
            if (!isTargetForGlightbox()) return;

            // 确保GLightbox已加载
            try {
                await loadGLightbox();
            } catch (e) {
                console.warn('[GLIGHTBOX] 加载失败:', e);
                return;
            }

            if (typeof GLightbox === 'undefined') {
                console.warn('[GLIGHTBOX] 未加载');
                return;
            }

            console.log('[GLIGHTBOX] 开始初始化');

            // 先销毁现有的GLightbox实例
            if (glightboxInstance) {
                try {
                    glightboxInstance.destroy();
                } catch (e) {
                    console.log('[GLIGHTBOX] 清理旧实例');
                }
            }

            // 获取所有聊天图片元素
            const chatImages = document.querySelectorAll('.message-container.robot .message-image');
            console.log('[GLIGHTBOX] 找到', chatImages.length, '个图片元素');

            if (chatImages.length === 0) {
                console.log('[GLIGHTBOX] 没有找到图片元素');
                return;
            }

            // 创建GLightbox元素数组
            const lightboxElements = Array.from(chatImages).map((img, index) => {
                return {
                    href: img.src,
                    type: 'image'
                };
            });

            // 初始化GLightbox
            glightboxInstance = GLightbox({
                elements: lightboxElements,
                autoplayVideos: false,
                touchNavigation: true,
                loop: false,
                closeButton: true,
                zoomable: true,
                draggable: true,
                openEffect: 'zoom',
                closeEffect: 'zoom',
                slideEffect: 'slide'
            });

            console.log('[GLIGHTBOX] 初始化完成，包含', lightboxElements.length, '个图片');

            // 为每个图片项添加点击事件
            setupImageClickHandlers();

        }, 100);
    }

    /**
     * 检查是否应该为聊天图片启用GLightbox
     */
    function isTargetForGlightbox() {
        // 检查是否有聊天图片
        const chatImages = document.querySelectorAll('.message-container.robot .message-image');
        return chatImages.length > 0;
    }

    /**
     * 设置图片点击事件处理
     */
    function setupImageClickHandlers() {
        if (!glightboxInstance) {
            console.warn('[GLIGHTBOX] 未初始化，无法设置点击事件');
            return;
        }

        const chatImages = document.querySelectorAll('.message-container.robot .message-image');
        console.log('设置点击事件，找到', chatImages.length, '个图片项');

        chatImages.forEach((img, index) => {
            // 移除旧的点击事件
            img.removeEventListener('click', handleImageClick);

            // 添加新的点击事件
            img.addEventListener('click', handleImageClick);
        });

        console.log('图片点击事件设置完成');
    }

    /**
     * 处理图片点击事件
     */
    function handleImageClick(event) {
        // 阻止事件冒泡，避免触发其他可能的事件
        event.stopPropagation();

        const img = event.currentTarget;

        if (!img || !glightboxInstance) {
            console.warn('GLightbox未初始化或图片未找到');
            return;
        }

        // 查找当前图片在画廊中的索引
        const chatImages = document.querySelectorAll('.message-container.robot .message-image');
        let index = -1;

        for (let i = 0; i < chatImages.length; i++) {
            if (chatImages[i] === img) {
                index = i;
                break;
            }
        }

        if (index !== -1) {
            console.log('打开GLightbox，索引:', index);
            glightboxInstance.openAt(index);
        } else {
            console.warn('未找到图片索引');
        }
    }

    /**
     * 更新GLightbox（当新图片加载完成后调用）
     */
    async function updateGLightbox() {
        // 确保GLightbox已加载
        try {
            await loadGLightbox();
        } catch (e) {
            console.warn('[GLIGHTBOX] 加载失败:', e);
            return;
        }

        if (!glightboxInstance) {
            console.log('[GLIGHTBOX] 未初始化，重新初始化');
            initGLightbox();
            return;
        }

        console.log('[GLIGHTBOX] 更新图片列表');

        // 获取所有聊天图片元素
        const chatImages = document.querySelectorAll('.message-container.robot .message-image');

        if (chatImages.length === 0) {
            console.warn('[GLIGHTBOX] 没有找到图片元素');
            return;
        }

        // 创建新的元素数组
        const newElements = Array.from(chatImages).map((img) => {
            return {
                href: img.src,
                type: 'image'
            };
        });

        // 更新GLightbox实例
        try {
            glightboxInstance.destroy();

            glightboxInstance = GLightbox({
                elements: newElements,
                autoplayVideos: false,
                touchNavigation: true,
                loop: false,
                closeButton: true,
                zoomable: true,
                draggable: true,
                openEffect: 'zoom',
                closeEffect: 'zoom',
                slideEffect: 'slide'
            });

            console.log('[GLIGHTBOX] 更新完成，现在包含', newElements.length, '个图片');

            // 重新设置点击事件
            setupImageClickHandlers();

        } catch (error) {
            console.error('[GLIGHTBOX] 更新时出错:', error);
            // 如果出错，重新初始化
            initGLightbox();
        }
    }

    // 生成浏览器指纹
    function generateBrowserFingerprint() {
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            !!navigator.cookieEnabled,
            navigator.hardwareConcurrency || 'unknown',
            navigator.platform
        ];
        
        const data = components.join('|');
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    // 初始化用户会话
    async function initUserSession() {
        try {
            if (!browserFingerprint) {
                browserFingerprint = generateBrowserFingerprint();
            }
            
            const timestamp = Date.now();
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (userToken) {
                headers['x-auth-token'] = userToken;
            }
            
            console.log('正在初始化用户会话...', { 
                fingerprint: browserFingerprint, 
                timestamp: timestamp,
                hasToken: !!userToken 
            });
            
            const response = await fetch(`${config.AUTH_API_URL}/api/user/init`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ 
                    fingerprint: browserFingerprint, 
                    timestamp: timestamp 
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('用户初始化响应:', data);
            
            if (data.success) {
                currentUserId = data.userId;
                currentAvatar = data.avatar;
                userToken = data.token;
                
                localStorage.setItem('user_token', userToken);
                localStorage.setItem('user_id', currentUserId);
                localStorage.setItem('user_avatar', JSON.stringify(currentAvatar));
                
                return {
                    success: true,
                    userId: currentUserId,
                    avatar: currentAvatar,
                    token: userToken,
                    isNew: data.isNew
                };
            }
            
            return { success: false, message: data.message || '用户初始化失败' };
        } catch (error) {
            console.error('用户初始化失败:', error);
            return { 
                success: false, 
                message: '网络请求失败: ' + error.message 
            };
        }
    }

    // 验证管理员令牌
    async function verifyAdminToken() {
        if (!authToken) return { valid: false };
        
        try {
            const response = await fetch(`${config.AUTH_API_URL}/auth/verify?token=${authToken}`);
            if (!response.ok) return { valid: false };
            
            const data = await response.json();
            if (data.valid) {
                isAdminMode = true;
                return { 
                    valid: true, 
                    account: data.account,
                    realMasterQQ: data.realMasterQQ 
                };
            }
        } catch (error) {
            console.error('管理员验证失败:', error);
        }
        
        localStorage.removeItem('auth_token');
        authToken = null;
        return { valid: false };
    }

    // 管理员登录
    async function adminLogin(account, password) {
        try {
            const blogUserId = currentUserId;
            const response = await fetch(`${config.AUTH_API_URL}/auth/master`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ account, password ,blogUserId})
            });
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                authToken = data.token;
                localStorage.setItem('auth_token', authToken);
                isAdminMode = true;
                
                return { 
                    success: true, 
                    token: authToken,
                    realMasterQQ: data.realMasterQQ 
                };
            }
            
            return { success: false, message: data.message || '账号或密码错误' };
        } catch (error) {
            console.error('管理员登录失败:', error);
            return { 
                success: false, 
                message: '登录失败: ' + error.message 
            };
        }
    }

    // 管理员注销
    function adminLogout() {
        if (authToken) {
            fetch(`${config.AUTH_API_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authToken })
            }).catch(error => console.error('注销请求失败:', error));
        }
        
        authToken = null;
        isAdminMode = false;
        welcomeMessageShown = false; // 重置欢迎消息标记，下次普通用户登录时可以显示
        localStorage.removeItem('auth_token');
    }

    // 创建UI元素
    const chatIcon = document.createElement('div');
    chatIcon.id = 'chatIcon';
    
    const svgIcon = document.createElement('img');
    svgIcon.src = CHAT_ICON_SVG;
    svgIcon.alt = '聊天图标';
    svgIcon.className = 'chat-svg-icon';
    chatIcon.appendChild(svgIcon);
    
    document.body.appendChild(chatIcon);
    
    const bubbleTip = document.createElement('div');
    bubbleTip.className = 'bubble-tip';
    bubbleTip.innerHTML = '好无聊~ ╮(╯▽╰)╭<br/>快点击信息框来找桃妹聊天吧！';
    chatIcon.appendChild(bubbleTip);
    
    let bubbleTimer = null;
    let bubbleVisible = false;
    
    function showBubble() {
        const isChatClosed = chatWindow.style.display !== 'flex';
        
        if (!bubbleVisible && isChatClosed) {
            bubbleTip.style.display = 'block';
            bubbleVisible = true;
            
            setTimeout(() => {
                if (bubbleVisible) {
                    bubbleTip.style.display = 'none';
                    bubbleVisible = false;
                }
            }, 10000);
        }
    }
    
    bubbleTip.addEventListener('click', () => {
        bubbleTip.style.display = 'none';
        bubbleVisible = false;
        
        clearInterval(bubbleTimer);
        bubbleTimer = setInterval(showBubble, 120000);
    });
    
    bubbleTimer = setInterval(showBubble, 120000);
    
    const chatWindow = document.createElement('div');
    chatWindow.id = 'chatWindow';
    document.body.appendChild(chatWindow);
    
    // ==================== 鼠标视差效果 ====================
    let parallaxEnabled = true;
    
    function initParallaxEffect(gradientsContainer) {
        if (!gradientsContainer) return;
        
        const ellipse2 = gradientsContainer.querySelector('.chat-gradient-ellipse-2');
        const ellipse3 = gradientsContainer.querySelector('.chat-gradient-ellipse-3');
        
        if (!ellipse2 || !ellipse3) return;
        
        chatWindow.addEventListener('mousemove', (e) => {
            if (!parallaxEnabled) return;
            
            const rect = chatWindow.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            
            // 粉色球移动更多
            ellipse2.style.transform = `translate(${x * 30}px, ${y * 30}px)`;
            // 蓝色球移动较少
            ellipse3.style.transform = `translate(${x * -20}px, ${y * -20}px)`;
        });
        
        chatWindow.addEventListener('mouseleave', () => {
            ellipse2.style.transform = 'translate(0, 0)';
            ellipse3.style.transform = 'translate(0, 0)';
        });
    }
    
    function initChatSystem() {
        // ==================== 创建背景层 ====================
        // 背景容器
        const windowBackground = document.createElement('div');
        windowBackground.className = 'chat-window-background';
        
        // 白色底色
        const bgWhite = document.createElement('div');
        bgWhite.className = 'chat-window-bg-white';
        windowBackground.appendChild(bgWhite);
        
        // 渐变球容器
        const gradientsContainer = document.createElement('div');
        gradientsContainer.className = 'chat-window-gradients';
        
        // 粉色渐变球
        const ellipse2 = document.createElement('div');
        ellipse2.className = 'chat-gradient-ellipse-2';
        gradientsContainer.appendChild(ellipse2);
        
        // 蓝色渐变球
        const ellipse3 = document.createElement('div');
        ellipse3.className = 'chat-gradient-ellipse-3';
        gradientsContainer.appendChild(ellipse3);
        
        windowBackground.appendChild(gradientsContainer);
        
        // 蒙版层
        const overlay = document.createElement('div');
        overlay.className = 'chat-window-overlay';
        windowBackground.appendChild(overlay);
        
        chatWindow.appendChild(windowBackground);
        
        // 初始化视差效果
        initParallaxEffect(gradientsContainer);
        
        // ==================== 内容容器 ====================
        const windowContent = document.createElement('div');
        windowContent.className = 'chat-window-content';
        
        // ==================== Header 区域 ====================
        const header = document.createElement('div');
        header.className = 'chat-header-main';
        
        // Bot头像
        const headerAvatar = document.createElement('img');
        headerAvatar.className = 'chat-header-avatar';
        headerAvatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
        headerAvatar.alt = `${botInfo.name || '机器人'}头像`;
        header.appendChild(headerAvatar);
        
        // Bot信息容器
        const headerInfo = document.createElement('div');
        headerInfo.className = 'chat-header-info';
        
        // Bot名称
        const headerName = document.createElement('div');
        headerName.className = 'chat-header-name';
        headerName.textContent = botInfo.name || 'TaoMei';
        headerInfo.appendChild(headerName);
        
        // Bot状态
        const headerStatus = document.createElement('div');
        headerStatus.className = 'chat-header-status';
        
        const statusDot = document.createElement('div');
        statusDot.className = 'chat-status-dot';
        headerStatus.appendChild(statusDot);
        
        const statusText = document.createElement('div');
        statusText.className = 'chat-status-text';
        statusText.textContent = 'online';
        statusText.id = 'statusText';
        headerStatus.appendChild(statusText);
        
        headerInfo.appendChild(headerStatus);
        header.appendChild(headerInfo);
        
        // Header按钮组
        const headerButtons = document.createElement('div');
        headerButtons.className = 'chat-header-buttons';
        
        // 日志按钮
        const logButton = document.createElement('div');
        logButton.className = 'chat-header-btn chat-log-btn';
        logButton.innerHTML = '<img src="./assets/CodeBubbyAssets/3_356/11.svg" alt="日志">';
        logButton.title = '查看日志';
        headerButtons.appendChild(logButton);
        
        // 管理员入口按钮
        const adminEntryButton = document.createElement('div');
        adminEntryButton.className = 'chat-header-btn chat-admin-btn';
        adminEntryButton.innerHTML = '<img src="./assets/CodeBubbyAssets/3_356/10.svg" alt="管理员">';
        adminEntryButton.title = '管理员登录';
        headerButtons.appendChild(adminEntryButton);
        
        header.appendChild(headerButtons);
        windowContent.appendChild(header);
        
        // 状态指示器（用于连接状态）
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'statusIndicator';
        statusIndicator.style.display = 'none'; // 隐藏旧的状态显示
        
        // ==================== 消息区域包装器 ====================
        const messageAreaWrapper = document.createElement('div');
        messageAreaWrapper.className = 'message-area-wrapper';
        
        // 消息区域背景图片
        const messageAreaBg = document.createElement('img');
        messageAreaBg.className = 'message-area-bg';
        messageAreaBg.src = './assets/CodeBubbyAssets/3_356/26.png';
        messageAreaWrapper.appendChild(messageAreaBg);
        
        // 消息区域半透明层（现在包含所有内容）
        const messageAreaOverlay = document.createElement('div');
        messageAreaOverlay.className = 'message-area-overlay';
        
        // ==================== 消息区域（可滚动） ====================
        const messageArea = document.createElement('div');
        messageArea.id = 'messageArea';
        
        // ==================== Bot Info Area（在messageArea内部） ====================
        const botInfoArea = document.createElement('div');
        botInfoArea.className = 'bot-info-area';
        
        // Bot头像容器
        const botInfoAvatarWrapper = document.createElement('div');
        botInfoAvatarWrapper.className = 'bot-info-avatar-wrapper';
        
        const botInfoAvatar = document.createElement('img');
        botInfoAvatar.className = 'bot-info-avatar';
        botInfoAvatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
        botInfoAvatar.alt = `${botInfo.name || '机器人'}头像`;
        botInfoAvatarWrapper.appendChild(botInfoAvatar);
        
        // 条形码容器
        const botInfoBarcodeWrapper = document.createElement('div');
        botInfoBarcodeWrapper.className = 'bot-info-barcode-wrapper';
        
        const botInfoBarcode = document.createElement('div');
        botInfoBarcode.className = 'bot-info-barcode';
        botInfoBarcode.id = 'botInfoBarcode';
        botInfoBarcodeWrapper.appendChild(botInfoBarcode);
        
        // Session ID
        const botInfoSessionId = document.createElement('div');
        botInfoSessionId.className = 'bot-info-session-id';
        botInfoSessionId.id = 'botInfoSessionId';
        botInfoSessionId.textContent = currentUserId ? `blog-${currentUserId.substring(0, 8)}` : 'blog-loading...';
        botInfoBarcodeWrapper.appendChild(botInfoSessionId);
        
        botInfoAvatarWrapper.appendChild(botInfoBarcodeWrapper);
        botInfoArea.appendChild(botInfoAvatarWrapper);
        messageArea.appendChild(botInfoArea);
        
        // 用户登录表单
        const userLoginForm = document.createElement('div');
        userLoginForm.className = 'user-login-form';
        userLoginForm.style.display = 'none';
        
        const userLoginMessage = document.createElement('div');
        userLoginMessage.className = 'login-message';
        userLoginMessage.textContent = '正在初始化用户会话...';
        userLoginForm.appendChild(userLoginMessage);
        
        const loginSpinner = document.createElement('div');
        loginSpinner.className = 'login-spinner';
        userLoginForm.appendChild(loginSpinner);
        
        // ==================== 管理员登录面板（按Figma设计） ====================
        const adminLoginPanel = document.createElement('div');
        adminLoginPanel.className = 'admin-login-panel';
        adminLoginPanel.id = 'adminLoginPanel';
        adminLoginPanel.style.display = 'none';
        
        // 登录面板头部（message-login-header）
        const adminLoginHeader = document.createElement('div');
        adminLoginHeader.className = 'admin-login-header';
        
        // 背景装饰（4.svg）
        const adminLoginHeaderBg = document.createElement('div');
        adminLoginHeaderBg.className = 'admin-login-header-bg';
        adminLoginHeader.appendChild(adminLoginHeaderBg);
        
        // 标题
        const adminLoginTitle = document.createElement('div');
        adminLoginTitle.className = 'admin-login-title';
        adminLoginTitle.textContent = 'Administrator Login';
        adminLoginHeader.appendChild(adminLoginTitle);
        
        // 关闭按钮（backBtn）- 5.svg
        const adminLoginCloseBtn = document.createElement('div');
        adminLoginCloseBtn.className = 'admin-login-close-btn';
        adminLoginCloseBtn.id = 'adminLoginCloseBtn';
        adminLoginCloseBtn.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/9.svg" alt="返回">';
        adminLoginHeader.appendChild(adminLoginCloseBtn);
        
        adminLoginPanel.appendChild(adminLoginHeader);
        
        // 登录面板内容区域（message-Login-Area）
        const adminLoginContent = document.createElement('div');
        adminLoginContent.className = 'admin-login-content';
        
        // 头像区域
        const adminLoginAvatarWrapper = document.createElement('div');
        adminLoginAvatarWrapper.className = 'admin-login-avatar-wrapper';
        
        const adminLoginAvatar = document.createElement('img');
        adminLoginAvatar.className = 'admin-login-avatar';
        adminLoginAvatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
        adminLoginAvatar.alt = 'Bot';
        adminLoginAvatarWrapper.appendChild(adminLoginAvatar);
        
        adminLoginContent.appendChild(adminLoginAvatarWrapper);
        
        // Bot-login-info-area
        const adminLoginInfoArea = document.createElement('div');
        adminLoginInfoArea.className = 'admin-login-info-area';
        
        // 账号输入容器
        const adminAccountWrapper = document.createElement('div');
        adminAccountWrapper.className = 'admin-input-wrapper';
        
        const adminAccountIcon = document.createElement('div');
        adminAccountIcon.className = 'admin-input-icon';
        adminAccountIcon.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/11.svg" alt="账号">';
        
        const adminAccountInput = document.createElement('input');
        adminAccountInput.className = 'admin-input-field';
        adminAccountInput.placeholder = '账号';
        adminAccountInput.id = 'adminAccountInput';
        adminAccountInput.type = 'text';
        
        adminAccountWrapper.appendChild(adminAccountIcon);
        adminAccountWrapper.appendChild(adminAccountInput);
        adminLoginInfoArea.appendChild(adminAccountWrapper);
        
        // 密码输入容器
        const adminPasswordWrapper = document.createElement('div');
        adminPasswordWrapper.className = 'admin-input-wrapper';
        
        const adminPasswordIcon = document.createElement('div');
        adminPasswordIcon.className = 'admin-input-icon';
        adminPasswordIcon.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/12.svg" alt="密码">';
        
        const adminPasswordInput = document.createElement('input');
        adminPasswordInput.className = 'admin-input-field';
        adminPasswordInput.placeholder = '密码';
        adminPasswordInput.id = 'adminPasswordInput';
        adminPasswordInput.type = 'password';
        
        // 密码可见/不可见图标切换
        const passwordToggleIcon = document.createElement('div');
        passwordToggleIcon.className = 'password-toggle-icon';
        passwordToggleIcon.id = 'passwordToggleIcon';
        // 默认显示不可见图标（13.svg）
        passwordToggleIcon.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/13.svg" alt="显示密码">';
        passwordToggleIcon.dataset.visible = 'false';
        
        adminPasswordWrapper.appendChild(adminPasswordIcon);
        adminPasswordWrapper.appendChild(adminPasswordInput);
        adminPasswordWrapper.appendChild(passwordToggleIcon);
        adminLoginInfoArea.appendChild(adminPasswordWrapper);
        
        adminLoginContent.appendChild(adminLoginInfoArea);
        
        // Login按钮
        const adminLoginButton = document.createElement('button');
        adminLoginButton.className = 'admin-login-btn';
        adminLoginButton.id = 'adminLoginBtn';
        adminLoginButton.textContent = 'Login';
        adminLoginContent.appendChild(adminLoginButton);
        
        adminLoginPanel.appendChild(adminLoginContent);
        
        // 错误消息（隐藏状态）
        const adminLoginMessage = document.createElement('div');
        adminLoginMessage.className = 'admin-login-message';
        adminLoginMessage.id = 'adminLoginMessage';
        adminLoginMessage.style.display = 'none';
        adminLoginPanel.appendChild(adminLoginMessage);
        
        // 引用变量（用于后续代码兼容）
        const adminLoginForm = adminLoginPanel;
        
        // 聊天界面（简化为仅显示机器人头像）
        const chatInterface = document.createElement('div');
        chatInterface.className = 'chat-interface';
        chatInterface.style.display = 'none';
        
        messageArea.appendChild(userLoginForm);
        messageArea.appendChild(adminLoginPanel);
        messageArea.appendChild(chatInterface);
        
        messageAreaOverlay.appendChild(messageArea);
        
        // ==================== 快捷按钮容器（现在在overlay内部） ====================
        const quickButtonsContainer = document.createElement('div');
        quickButtonsContainer.className = 'quick-buttons-container';
        
        // 快捷按钮配置
        const quickButtons = [
            { text: 'hello,Who are you?', message: '你好，你是谁' },
            { text: 'Please tell me some things ...', message: '推荐几篇博客文章' },
            { text: '2026 hot internet ...', message: '网络搜索2026互联网热梗' }
        ];
        
        quickButtons.forEach((btn, index) => {
            const button = document.createElement('button');
            button.className = 'quick-button';
            button.textContent = btn.text;
            button.title = btn.text;
            button.dataset.message = btn.message;
            
            button.addEventListener('click', () => {
                const message = button.dataset.message;
                if (message && socket && socket.readyState === WebSocket.OPEN) {
                    console.log('[QUICK] 点击快捷按钮:', message);
                    messageInput.value = message;
                    sendMessage();
                } else {
                    console.warn('[QUICK] 无法发送消息:', { hasSocket: !!socket, readyState: socket?.readyState });
                }
            });
            
            quickButtonsContainer.appendChild(button);
        });
        
        // 更多按钮
        const moreButton = document.createElement('button');
        moreButton.className = 'more-button';
        moreButton.innerHTML = '<img src="./assets/CodeBubbyAssets/3_356/7.svg" alt="更多" style="width: 24px; height: 24px;">';
        moreButton.style.display = 'none';
        quickButtonsContainer.appendChild(moreButton);
        
        // 更多按钮提示
        const moreButtonTooltip = document.createElement('div');
        moreButtonTooltip.className = 'more-button-tooltip';
        moreButtonTooltip.textContent = '更多';
        document.body.appendChild(moreButtonTooltip);
        
        // 下拉菜单
        const moreButtonDropdown = document.createElement('div');
        moreButtonDropdown.className = 'more-button-dropdown';
        document.body.appendChild(moreButtonDropdown);
        
        messageAreaOverlay.appendChild(quickButtonsContainer);
        
        // ==================== 消息输入区域（现在在overlay内部） ====================
        const messageInputArea = document.createElement('div');
        messageInputArea.className = 'message-input-area';
        
        // 表情包按钮
        const emojiButton = document.createElement('div');
        emojiButton.className = 'emoji-button';
        emojiButton.innerHTML = '<img src="./assets/CodeBubbyAssets/3_356/6.svg" alt="表情">';
        emojiButton.title = '表情包（暂未开放）';
        messageInputArea.appendChild(emojiButton);
        
        // 输入框
        const messageInput = document.createElement('input');
        messageInput.className = 'message-input';
        messageInput.placeholder = 'send message to Bot';
        messageInput.id = 'chatMessageInput';
        messageInput.name = 'message';
        messageInput.autocomplete = 'off';
        messageInputArea.appendChild(messageInput);
        
        // 发送按钮
        const sendButton = document.createElement('button');
        sendButton.className = 'send-button';
        sendButton.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/enter.svg" alt="发送">';
        // sendButton.textContent = 'Enter';
        messageInputArea.appendChild(sendButton);
        
        messageAreaOverlay.appendChild(messageInputArea);
        
        // ==================== 提示区域（现在在overlay内部） ====================
        const tipsArea = document.createElement('div');
        tipsArea.className = 'tips-area';
        
        const tipsContent = document.createElement('div');
        tipsContent.className = 'tips-content';
        tipsContent.innerHTML = '<span class="tips-text"><em>AI</em>可能会生成错误的信息，请注意核实。</span>';
        
        tipsArea.appendChild(tipsContent);
        messageAreaOverlay.appendChild(tipsArea);
        
        // 将overlay添加到wrapper
        messageAreaWrapper.appendChild(messageAreaOverlay);
        windowContent.appendChild(messageAreaWrapper);
        
        // ==================== 系统消息Log面板 ====================
        // 系统消息历史记录
        const systemMsgHistory = [];
        
        // Log面板容器
        const logPanel = document.createElement('div');
        logPanel.className = 'chat-log-panel';
        logPanel.style.display = 'none';
        
        // Log面板头部
        const logPanelHeader = document.createElement('div');
        logPanelHeader.className = 'chat-log-header';
        
        const logPanelTitle = document.createElement('div');
        logPanelTitle.className = 'chat-log-title';
        logPanelTitle.textContent = 'System Message History';
        
        const logPanelClose = document.createElement('div');
        logPanelClose.className = 'chat-log-close';
        logPanelClose.innerHTML = '<img src="./assets/CodeBubbyAssets/14_165/10.svg" alt="关闭">';
        
        logPanelHeader.appendChild(logPanelTitle);
        logPanelHeader.appendChild(logPanelClose);
        logPanel.appendChild(logPanelHeader);
        
        // Log面板内容区域
        const logPanelContent = document.createElement('div');
        logPanelContent.className = 'chat-log-content';
        logPanelContent.id = 'logPanelContent';
        logPanel.appendChild(logPanelContent);
        
// 点击日志按钮显示Log面板
logButton.addEventListener('click', () => {
    if (logPanel.style.display === 'none') {
        // 更新Log面板内容
        renderLogPanel();
        logPanel.style.display = 'flex';
        // 设置按钮为active状态
        logButton.classList.add('log-btn-active');
        logButton.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/log-btn-active.svg" alt="日志">';
        
        // 如果登录面板显示，隐藏它
        if (adminLoginPanel.style.display !== 'none') {
            adminLoginPanel.style.display = 'none';
            adminEntryButton.classList.remove('admin-btn-active');
            adminEntryButton.innerHTML = '<img src="./assets/CodeBubbyAssets/3_356/10.svg" alt="管理员">';
        }
    } else {
        logPanel.style.display = 'none';
        // 恢复按钮为普通状态
        logButton.classList.remove('log-btn-active');
        logButton.innerHTML = '<img src="./assets/CodeBubbyAssets/3_356/11.svg" alt="日志">';
    }
});
        
// 点击关闭按钮隐藏Log面板
logPanelClose.addEventListener('click', () => {
    logPanel.style.display = 'none';
    // 恢复按钮为普通状态
    logButton.classList.remove('log-btn-active');
    logButton.innerHTML = '<img src="./assets/CodeBubbyAssets/3_356/11.svg" alt="日志">';
});
        
        // 渲染Log面板内容
        function renderLogPanel() {
            logPanelContent.innerHTML = '';
            
            if (systemMsgHistory.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'chat-log-empty';
                emptyMsg.textContent = '暂无系统消息';
                logPanelContent.appendChild(emptyMsg);
                return;
            }
            
            systemMsgHistory.forEach(msg => {
                const logItem = document.createElement('div');
                logItem.className = 'chat-log-item';
                
                // 机器人头像
                const avatarContainer = document.createElement('div');
                avatarContainer.className = 'chat-log-avatar';
                const avatar = document.createElement('img');
                avatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
                avatarContainer.appendChild(avatar);
                
                // 消息气泡
                const bubbleContainer = document.createElement('div');
                bubbleContainer.className = 'chat-log-bubble-wrapper';
                
                const bubble = document.createElement('div');
                bubble.className = 'chat-log-bubble';
                bubble.innerHTML = msg.text.replace(/\n/g, '<br>');
                
                // 时间戳
                const timestamp = document.createElement('div');
                timestamp.className = 'chat-log-timestamp';
                timestamp.textContent = msg.time;
                
                bubbleContainer.appendChild(bubble);
                
                logItem.appendChild(avatarContainer);
                logItem.appendChild(bubbleContainer);
                logItem.appendChild(timestamp);
                logPanelContent.appendChild(logItem);
            });
        }
        
        // 添加Log面板到messageAreaWrapper（覆盖层）
        messageAreaWrapper.appendChild(logPanel);
        
        // 管理员模式徽章
        const adminModeBadge = document.createElement('div');
        adminModeBadge.className = 'admin-mode-badge';
        adminModeBadge.textContent = '管理员模式';
        adminModeBadge.style.display = 'none';
        
        // 添加内容容器到窗口
        chatWindow.appendChild(windowContent);
        
        // 注意：inputGroup 变量引用 messageInputArea
        const inputGroup = messageInputArea;
        
        // 更多按钮悬停提示
        moreButton.addEventListener('mouseenter', (e) => {
            const rect = moreButton.getBoundingClientRect();
            moreButtonTooltip.style.left = (rect.left + rect.width / 2) + 'px';
            moreButtonTooltip.style.top = (rect.top - 30) + 'px';
            moreButtonTooltip.style.transform = 'translateX(-50%)';
            moreButtonTooltip.classList.add('show');
        });
        
        moreButton.addEventListener('mouseleave', () => {
            moreButtonTooltip.classList.remove('show');
        });
        
        // 更多按钮点击
        moreButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = moreButton.getBoundingClientRect();
            
            const dropdownTop = rect.top - moreButtonDropdown.offsetHeight;
            const dropdownLeft = rect.left - moreButtonDropdown.offsetWidth;
            
            moreButtonDropdown.style.top = (dropdownTop - 50) + 'px';
            moreButtonDropdown.style.left = (dropdownLeft - 110) + 'px';
            moreButtonDropdown.style.right = 'auto';
            
            moreButtonDropdown.classList.toggle('show');
        });
        
        // 点击其他地方关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!moreButtonDropdown.contains(e.target) && !moreButton.contains(e.target)) {
                moreButtonDropdown.classList.remove('show');
            }
        });
        
        // 动态计算显示按钮的函数
        function updateQuickButtonsVisibility() {
            const containerWidth = quickButtonsContainer.clientWidth - 40;
            const buttons = Array.from(quickButtonsContainer.querySelectorAll('.quick-button'));
            
            let totalWidth = 0;
            let visibleCount = 0;
            
            moreButtonDropdown.innerHTML = '';
            
            buttons.forEach((btn, index) => {
                const buttonWidth = btn.offsetWidth;
                
                if (totalWidth + buttonWidth <= containerWidth) {
                    btn.style.display = 'block';
                    btn.style.visibility = 'visible';
                    totalWidth += buttonWidth;
                    visibleCount++;
                } else {
                    btn.style.visibility = 'hidden';
                    btn.style.display = 'none';
                    
                    const dropdownBtn = btn.cloneNode(true);
                    dropdownBtn.style.display = 'block';
                    dropdownBtn.style.visibility = 'visible';
                    
                    dropdownBtn.addEventListener('click', () => {
                        const message = dropdownBtn.dataset.message;
                        if (message && socket && socket.readyState === WebSocket.OPEN) {
                            console.log('[QUICK] 点击下拉菜单快捷按钮:', message);
                            messageInput.value = message;
                            sendMessage();
                            moreButtonDropdown.classList.remove('show');
                        }
                    });
                    
                    moreButtonDropdown.appendChild(dropdownBtn);
                }
            });
            
            const hasHiddenButtons = buttons.some(btn => btn.style.display === 'none');
            if (hasHiddenButtons) {
                moreButton.style.display = 'flex';
            } else {
                moreButton.style.display = 'none';
                moreButtonDropdown.classList.remove('show');
            }
            
            if (buttons.length > 0 && visibleCount === 0) {
                buttons[0].style.display = 'block';
                buttons[0].style.visibility = 'visible';
            }
        }
        
        // 初始化和窗口大小改变时更新
        window.addEventListener('resize', updateQuickButtonsVisibility);
        
        let socket = null;
        let reconnectAttempts = 0;
        const MAX_RECONNECT_ATTEMPTS = 5;
        let messageCounter = 100000;
        let connectionState = 'disconnected';
        
        // 打字指示器和超时器
        let typingIndicators = {};
        let typingTimeouts = {};
        
        // 页面可见性和休眠恢复相关
        let lastActiveTime = Date.now();
        let isPageVisible = !document.hidden;
        let pendingMessages = []; // 缓存休眠期间可能丢失的消息
        let connectionHealthy = false;
        let welcomeMessageSent = false; // 标记欢迎消息是否已发送
        
        // 连接健康监控相关
        let lastServerResponseTime = Date.now();
        const RESPONSE_TIMEOUT = 300000;
        
        function processClickableText(text) {
            const startTag = '{BlogBot-add}';
            const endTag = '{/BlogBot-add}';
            const result = [];
            let currentIndex = 0;
            
            while (currentIndex < text.length) {
                const startIndex = text.indexOf(startTag, currentIndex);
                
                if (startIndex === -1) {
                    result.push({ type: 'text', content: text.substring(currentIndex) });
                    break;
                }
                
                if (startIndex > currentIndex) {
                    result.push({ type: 'text', content: text.substring(currentIndex, startIndex) });
                }
                
                const endIndex = text.indexOf(endTag, startIndex + startTag.length);
                
                if (endIndex === -1) {
                    result.push({ type: 'text', content: text.substring(startIndex) });
                    break;
                }
                
                const clickableText = text.substring(startIndex + startTag.length, endIndex);
                result.push({ type: 'clickable', content: clickableText });
                currentIndex = endIndex + endTag.length;
            }
            
            return result;
        }
        
        function createClickableElement(text) {
            const span = document.createElement('span');
            span.className = 'BlogBot-clickable-text';
            span.textContent = text;
            
            span.addEventListener('click', () => {
                const input = document.getElementById('chatMessageInput');
                if (input) {
                    input.value = text + ' ';
                    input.focus();
                }
            });
            
            return span;
        }
        
        function renderTextWithClickable(bubble, text) {
            const lines = text.split('\n');
            
            lines.forEach((line, lineIndex) => {
                const processed = processClickableText(line);
                
                processed.forEach(item => {
                    if (item.type === 'text') {
                        bubble.appendChild(document.createTextNode(item.content));
                    } else if (item.type === 'clickable') {
                        bubble.appendChild(createClickableElement(item.content));
                    }
                });
                
                if (lineIndex < lines.length - 1) {
                    bubble.appendChild(document.createElement('br'));
                }
            });
        }
        
        // 更新状态显示
        function updateStatus(text, color) {
            // 更新隐藏的状态指示器（用于逻辑判断）
            statusIndicator.innerHTML = `● ${text}`;
            statusIndicator.style.color = color;
            connectionState = text.toLowerCase();
            
            // 更新新UI的状态文本
            const statusTextEl = document.getElementById('statusText');
            const statusDotEl = document.querySelector('.chat-status-dot');
            if (statusTextEl) {
                if (text === '在线') {
                    statusTextEl.textContent = 'online';
                    statusTextEl.style.color = '#5CFF33';
                    if (statusDotEl) statusDotEl.style.background = '#5CFF33';
                } else if (text === '离线') {
                    statusTextEl.textContent = 'offline';
                    statusTextEl.style.color = '#ff4d4d';
                    if (statusDotEl) statusDotEl.style.background = '#ff4d4d';
                } else if (text === '连接中...') {
                    statusTextEl.textContent = 'connecting';
                    statusTextEl.style.color = '#ff9800';
                    if (statusDotEl) statusDotEl.style.background = '#ff9800';
                } else {
                    statusTextEl.textContent = text.toLowerCase();
                    statusTextEl.style.color = color;
                    if (statusDotEl) statusDotEl.style.background = color;
                }
            }
            
            console.log(`[STATUS] 连接状态更新: ${text}`);
        }
        
        function saveChatHistory() {
            if (!currentUserId) return;
            
            try {
                const allHistory = JSON.parse(localStorage.getItem(CHAT_HISTORY_CONFIG.storageKey) || '{}');
                
                const messages = Array.from(messageHistory.entries())
                    .map(([id, msg]) => ({
                        id: id,
                        content: msg.content,
                        sender: msg.sender,
                        type: msg.type,
                        timestamp: msg.timestamp
                    }))
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .slice(-CHAT_HISTORY_CONFIG.maxHistoryMessages);
                
                allHistory[currentUserId] = {
                    userId: currentUserId,
                    messages: messages,
                    savedAt: Date.now(),
                    userToken: userToken
                };
                
                const userIds = Object.keys(allHistory);
                if (userIds.length > CHAT_HISTORY_CONFIG.maxStorageUsers) {
                    const sortedUsers = userIds.sort((a, b) => 
                        (allHistory[b].savedAt || 0) - (allHistory[a].savedAt || 0)
                    );
                    const newHistory = {};
                    sortedUsers.slice(0, CHAT_HISTORY_CONFIG.maxStorageUsers).forEach(uid => {
                        newHistory[uid] = allHistory[uid];
                    });
                    localStorage.setItem(CHAT_HISTORY_CONFIG.storageKey, JSON.stringify(newHistory));
                } else {
                    localStorage.setItem(CHAT_HISTORY_CONFIG.storageKey, JSON.stringify(allHistory));
                }
                
                console.log(`[HISTORY] 已保存 ${messages.length} 条消息到本地存储`);
            } catch (e) {
                console.error('[HISTORY] 保存聊天记录失败:', e);
            }
        }
        
        function loadChatHistory() {
            if (!currentUserId) return false;
            
            try {
                const allHistory = JSON.parse(localStorage.getItem(CHAT_HISTORY_CONFIG.storageKey) || '{}');
                const userHistory = allHistory[currentUserId];
                
                if (!userHistory || !userHistory.messages || userHistory.messages.length === 0) {
                    console.log('[HISTORY] 没有找到历史记录');
                    return false;
                }
                
                if (userHistory.userToken && userHistory.userToken !== userToken) {
                    console.log('[HISTORY] token已变更，跳过历史恢复');
                    return false;
                }
                
                const messages = userHistory.messages.sort((a, b) => a.timestamp - b.timestamp);
                console.log(`[HISTORY] 找到 ${messages.length} 条历史消息`);
                
                return messages;
            } catch (e) {
                console.error('[HISTORY] 加载聊天记录失败:', e);
                return false;
            }
        }
        
        async function restoreChatHistory() {
            const messages = loadChatHistory();
            if (!messages) return;
            
            messageHistory.clear();
            
            const existingMessages = messageArea.querySelectorAll('.message-container');
            existingMessages.forEach(msg => msg.remove());
            
            console.log(`[HISTORY] 开始恢复 ${messages.length} 条历史消息`);
            
            let maxId = messageCounter;
            
            for (const msg of messages) {
                messageHistory.set(String(msg.id), {
                    content: msg.content,
                    sender: msg.sender,
                    type: msg.type,
                    element: null,
                    timestamp: msg.timestamp
                });
                
                const numId = parseInt(msg.id, 10);
                if (!isNaN(numId) && numId >= maxId) {
                    maxId = numId + 1;
                }
            }
            
            messageCounter = maxId;
            
            for (const msg of messages) {
                await addMessageInternal(msg.content, msg.sender, msg.type, msg.id, msg.timestamp);
            }
            
            scrollToBottom();
            console.log('[HISTORY] 历史消息恢复完成');
        }
        
        async function addMessageInternal(content, sender, type = 'text', messageId = null, timestamp = null) {
            const msgId = messageId || `msg_${Date.now()}_${messageCounter++}`;
            const msgTimestamp = timestamp || Date.now();
            
            const container = document.createElement('div');
            container.className = `message-container ${sender}`;
            container.dataset.messageId = msgId;
            
            if (!messageHistory.has(String(msgId))) {
                messageHistory.set(String(msgId), {
                    content: content,
                    sender: sender,
                    type: type,
                    element: container,
                    timestamp: msgTimestamp
                });
            } else {
                const existingMsg = messageHistory.get(String(msgId));
                existingMsg.element = container;
            }
            
            const avatarContainer = document.createElement('div');
            avatarContainer.className = 'avatar-container';
            
            const avatar = document.createElement('img');
            avatar.className = 'avatar-img';
            
            if (sender === 'user') {
                if (currentAvatar && currentAvatar.url) {
                    avatar.src = currentAvatar.url;
                } else {
                    avatar.src = 'https://q.qlogo.cn/g?b=qq&s=0&nk=0';
                }
            } else {
                avatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
            }
            
            avatarContainer.appendChild(avatar);
            container.appendChild(avatarContainer);
            
            const contentContainer = document.createElement('div');
            contentContainer.className = 'content-container';

            if (isAdminMode && sender === 'user') {
                const badge = document.createElement('span');
                badge.className = 'admin-badge';
                badge.textContent = '管理员';
                avatarContainer.appendChild(badge);
            }
            
            if (type === 'text') {
                const bubble = document.createElement('div');
                bubble.className = 'message-bubble';
                
                const hasClickable = content.includes('{BlogBot-add}');
                const isMarkdown = sender === 'robot' && detectMarkdown(content) && !hasClickable;
                console.log('[MESSAGE] 发送者:', sender, ', 是否Markdown:', isMarkdown, ', 是否有可点击:', hasClickable);
                
                if (hasClickable) {
                    renderTextWithClickable(bubble, content);
                    contentContainer.appendChild(bubble);
                } else if (isMarkdown) {
                    bubble.classList.add('markdown-content');
                    
                    bubble.textContent = '正在渲染...';
                    contentContainer.appendChild(bubble);
                    container.appendChild(contentContainer);
                    messageArea.appendChild(container);
                    
                    renderMarkdown(content).then(renderedContent => {
                        console.log('[MARKDOWN] 渲染结果长度:', renderedContent ? renderedContent.length : 0);
                        bubble.innerHTML = renderedContent;
                        
                        setTimeout(() => {
                            highlightCodeBlocks(bubble);
                            addCopyButtons(bubble);
                            requestAnimationFrame(() => {
                                scrollToBottom();
                            });
                        }, 100);
                        
                    }).catch(error => {
                        console.error('[MARKDOWN] 渲染错误:', error);
                        bubble.innerHTML = '';
                        const lines = content.split('\n');
                        lines.forEach((line, index) => {
                            bubble.appendChild(document.createTextNode(line));
                            if (index < lines.length - 1) {
                                bubble.appendChild(document.createElement('br'));
                            }
                        });
                        
                        requestAnimationFrame(() => {
                            scrollToBottom();
                        });
                    });
                    
                    return;
                } else {
                    const lines = content.split('\n');
                    lines.forEach((line, index) => {
                        bubble.appendChild(document.createTextNode(line));
                        if (index < lines.length - 1) {
                            bubble.appendChild(document.createElement('br'));
                        }
                    });
                    contentContainer.appendChild(bubble);
                }
            } 
            else if (type === 'image') {
                const img = document.createElement('img');
                img.className = 'message-image';

                if (content.startsWith('http://') || content.startsWith('https://') ||
                    content.startsWith('/') || content.startsWith('./') || content.startsWith('../')) {
                    img.src = content;
                } else if (content.startsWith('base64://')) {
                    const base64Data = content.replace('base64://', '');
                    img.src = `data:image/png;base64,${base64Data}`;
                } else {
                    console.warn('无法识别的图片格式:', content);
                    img.src = '';
                }

                contentContainer.appendChild(img);

                img.onload = () => {
                    setTimeout(() => {
                        updateGLightbox();
                        requestAnimationFrame(() => {
                            scrollToBottom();
                        });
                    }, 100);
                };
            }
            
            container.appendChild(contentContainer);
            messageArea.appendChild(container);
            
            requestAnimationFrame(() => {
                scrollToBottom();
            });
        }

        async function addMessage(content, sender, type = 'text', messageId = null) {
            const msgId = messageId || `msg_${Date.now()}_${messageCounter++}`;
            const msgTimestamp = Date.now();
            
            if (messageHistory.has(String(msgId))) {
                console.log(`[MESSAGE] 消息已存在: ${msgId}，跳过`);
                return;
            }
            
            messageHistory.set(String(msgId), {
                content: content,
                sender: sender,
                type: type,
                element: null,
                timestamp: msgTimestamp
            });
            
            await addMessageInternal(content, sender, type, msgId, msgTimestamp);
            
            saveChatHistory();
        }
        
        // 滚动到底部的辅助函数
        function scrollToBottom() {
            // 使用平滑滚动动画提供更好的用户体验
            messageArea.scrollTo({
                top: messageArea.scrollHeight,
                behavior: 'smooth'
            });
        }
        
        // 添加打字指示器
        function addTypingIndicator(messageId) {
            const container = document.createElement('div');
            container.id = `typing-indicator-${messageId}`;
            container.className = 'message-container robot';
            
            const avatarContainer = document.createElement('div');
            avatarContainer.className = 'avatar-container';
            
            const avatar = document.createElement('img');
            avatar.className = 'avatar-img';
            avatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
            avatarContainer.appendChild(avatar);
            container.appendChild(avatarContainer);
            
            const contentContainer = document.createElement('div');
            contentContainer.className = 'content-container';
            
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble typing-indicator';
            
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('span');
                dot.className = 'typing-dot';
                bubble.appendChild(dot);
            }
            
            contentContainer.appendChild(bubble);
            container.appendChild(contentContainer);
            messageArea.appendChild(container);
            messageArea.scrollTop = messageArea.scrollHeight;
            
            typingTimeouts[messageId] = setTimeout(() => {
                removeTypingIndicator(messageId);
                addSystemMessage('服务可能繁忙，可能会更长时间才能得到回复。请稍等，也可重复发送信息~');
            }, 120000);
            
            return container.id;
        }
        
        // 移除打字指示器
        function removeTypingIndicator(messageId) {
            const indicatorId = typingIndicators[messageId];
            if (indicatorId) {
                const indicator = document.getElementById(indicatorId);
                if (indicator) {
                    indicator.remove();
                }
                delete typingIndicators[messageId];
            }
            
            if (typingTimeouts[messageId]) {
                clearTimeout(typingTimeouts[messageId]);
                delete typingTimeouts[messageId];
            }
            
            // 机器人响应完成后滚动到底部
            scrollToBottom();
        }
        
        // 添加系统消息
        function addSystemMessage(text) {
            // 获取当前时间
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            // 添加到历史记录
            systemMsgHistory.push({
                time: timeStr,
                text: text
            });
            
            console.log(`[SYSTEM] ${text}`);
            
            // 如果是连接相关的系统消息，更新连接健康状态
            if (text.includes('连接') || text.includes('重连') || text.includes('在线')) {
                connectionHealthy = text.includes('成功') || text.includes('在线');
                if (connectionHealthy) {
                    lastServerResponseTime = Date.now();
                }
            }
        }
        
        // 停止心跳 - 使用桥接器时不需要主动心跳
        function stopHeartbeat() {
            // 桥接器负责心跳管理，前端不需要实现
        }
        
        // 发送心跳 - 使用桥接器时不需要主动心跳
        function sendHeartbeat() {
            // 桥接器负责心跳管理，前端不需要实现
        }
        
        // 检查连接是否健康 - 简化版本：只检查服务器响应
        function checkConnectionHealth() {
            const now = Date.now();
            const timeSinceLastResponse = now - lastServerResponseTime;
            
            // 只有在长时间没有收到服务器响应时才认为连接失效
            if (timeSinceLastResponse > RESPONSE_TIMEOUT * 3) { // 90秒无响应认为断连
                console.log('[HEALTH] 长时间未收到服务器响应，连接可能已失效');
                addSystemMessage('检测到连接异常，正在重新连接...');
                handleReconnect();
                return false;
            }
            
            return true;
        }
        
        // 连接WebSocket
        function connectWebSocket() {
            if (socket && (socket.readyState === WebSocket.OPEN || 
                           socket.readyState === WebSocket.CONNECTING)) {
                return;
            }
            
            if (!currentUserId) {
                console.warn('[WS] 用户ID未初始化，无法连接WebSocket');
                return;
            }
            
            updateStatus('连接中...', '#ff9800');
            addSystemMessage('正在建立连接...');
            
            try {
                if (socket) {
                    socket.close();
                    socket = null;
                }
                
                // 构建WebSocket URL，使用 wss 协议和 userId 参数
                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsHost = new URL(config.AUTH_API_URL).host;
                const wsUrl = `${wsProtocol}//${wsHost}/ws?userId=${currentUserId}`;
                
                console.log(`[WS] 连接到: ${wsUrl}`);
                socket = new WebSocket(wsUrl);
                
                socket.onopen = () => {
                    updateStatus('在线', '#4CAF50');
                    addSystemMessage('连接建立成功');
                    reconnectAttempts = 0;
                    connectionHealthy = true;
                    lastServerResponseTime = Date.now(); // 重置最后响应时间
                    
                    // 连接成功后，不再需要发送认证信息，由桥接器处理
                    console.log('[WS] 连接已建立，等待桥接器数据...');
                    
                    stopHeartbeat();
                    // 桥接器负责心跳管理，前端不需要主动心跳
                };
                
                // API请求处理器 - 已移除：由桥接器处理API请求
                
                // 消息接收处理器
                socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('[RECV] 收到消息', data);
                        
                        // 更新最后收到服务器响应时间
                        lastServerResponseTime = Date.now();
                        
                        // 更新连接健康状态
                        connectionHealthy = true;
                        lastActiveTime = Date.now();
                        
                        const messageIds = Object.keys(typingIndicators);
                        if (messageIds.length > 0) {
                            const oldestMessageId = messageIds[0];
                            removeTypingIndicator(oldestMessageId);
                        }
                        
                        // 处理从桥接器获取机器人信息
                        if (data.post_type === 'meta_event' && data.meta_event_type === 'lifecycle' && data.sub_type === 'connect') {
                            if (data.self_id) {
                                botInfo.qq = data.self_id;
                                console.log('[BOT INFO] 收到机器人QQ:', botInfo.qq);
                            }
                            if (data.nickname) {
                                botInfo.name = data.nickname;
                                console.log('[BOT INFO] 收到机器人名字:', botInfo.name);
                            }
                            // 更新header名称
                            const headerNameEl = document.querySelector('.chat-header-name');
                            if (headerNameEl) {
                                headerNameEl.textContent = botInfo.name || 'TaoMei';
                            }
                            // 更新header头像
                            const headerAvatarEl = document.querySelector('.chat-header-avatar');
                            if (headerAvatarEl) {
                                headerAvatarEl.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
                            }
                            // 更新bot-info头像
                            const botInfoAvatarEl = document.querySelector('.bot-info-avatar');
                            if (botInfoAvatarEl) {
                                botInfoAvatarEl.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
                            }
                            // 更新所有已存在的消息中的机器人头像
                            const allRobotMessages = document.querySelectorAll('.message-container.robot .avatar-img');
                            allRobotMessages.forEach(avatar => {
                                avatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
                            });
                            return;
                        }
                        
                        // 处理心跳响应 - 由桥接器管理
                        if (data.meta_event_type === 'heartbeat') {
                            console.log('[HEARTBEAT] 收到心跳响应');
                            return;
                        }
                        
                        // 处理转发消息
                        if (data.action === 'send_private_forward_msg' && data.params) {
                            addForwardMessage(data.params.messages);
                        }
                        
                        // 处理发送消息
                        if (data.action === 'send_msg' && data.params) {
                            const messageArray = data.params.message;
                            if (Array.isArray(messageArray)) {
                                let combinedText = '';
                                const images = [];
                                let replyId = null;
                                let replyContent = null;
                                
                                messageArray.forEach(segment => {
                                    if (segment.type === 'reply' && segment.data && segment.data.id) {
                                        replyId = String(segment.data.id);
                                        const historyMsg = messageHistory.get(replyId);
                                        if (historyMsg) {
                                            replyContent = historyMsg.content;
                                        }
                                    } else if (segment.type === 'text' && segment.data && segment.data.text) {
                                        combinedText += segment.data.text;
                                    } else if (segment.type === 'image') {
                                        const imgContent = segment.data.file || segment.data.url || '';
                                        if (imgContent) {
                                            images.push(imgContent);
                                        }
                                    } else if (segment.type === 'face') {
                                        combinedText += '[表情]';
                                    }
                                });
                                
                                let finalText = '';
                                if (replyContent) {
                                    const truncatedReply = replyContent.length > 100 
                                        ? replyContent.substring(0, 100) + '...' 
                                        : replyContent;
                                    finalText = `> ${truncatedReply}\n\n${combinedText}`;
                                } else {
                                    finalText = combinedText;
                                }
                                
                                if (finalText.trim()) {
                                    addMessage(finalText.trim(), 'robot');
                                }
                                
                                images.forEach(imgUrl => {
                                    addMessage(imgUrl, 'robot', 'image');
                                });
                            } else if (typeof messageArray === 'string') {
                                addMessage(messageArray, 'robot');
                            }
                        }
                        // 处理私聊消息
                        else if (data.post_type === 'message' && data.message_type === 'private') {
                            let messageText = '';
                            let replyId = null;
                            let replyContent = null;
                            
                            if (Array.isArray(data.message)) {
                                messageText = data.message.map(segment => {
                                    if (segment.type === 'reply' && segment.data && segment.data.id) {
                                        replyId = String(segment.data.id);
                                        const historyMsg = messageHistory.get(replyId);
                                        if (historyMsg) {
                                            replyContent = historyMsg.content;
                                        }
                                        return '';
                                    }
                                    if (segment.type === 'text') return segment.data.text;
                                    if (segment.type === 'image') return '[图片]';
                                    if (segment.type === 'face') return '[表情]';
                                    return '';
                                }).join('');
                            } else if (typeof data.message === 'string') {
                                messageText = data.message;
                            }
                            
                            let finalText = '';
                            if (replyContent) {
                                const truncatedReply = replyContent.length > 100 
                                    ? replyContent.substring(0, 100) + '...' 
                                    : replyContent;
                                finalText = `> ${truncatedReply}\n\n${messageText}`;
                            } else {
                                finalText = messageText;
                            }
                            
                            const msgId = data.message_id || null;
                            addMessage(finalText.trim(), 'robot', 'text', msgId);
                        }
                        // 处理系统消息
                        else if (data.post_type === 'system' && data.message) {
                            addSystemMessage(data.message);
                        }
                    } catch (e) {
                        console.error('[ERROR] 消息解析失败:', e);
                    }
                };
                
                socket.onerror = (error) => {
                    console.error('[ERROR] WebSocket错误:', error);
                    updateStatus('错误', '#f44336');
                    addSystemMessage('连接发生错误');
                    stopHeartbeat();
                };
                
                socket.onclose = (event) => {
                    updateStatus('离线', '#ff4d4d');
                    addSystemMessage(`连接已断开 (代码: ${event.code}, 原因: ${event.reason || '无'})`);
                    stopHeartbeat();
                    connectionHealthy = false;
                    
                    Object.keys(typingIndicators).forEach(removeTypingIndicator);
                    typingIndicators = {};
                    typingTimeouts = {};
                    
                    // 当连接意外关闭时，只有在非正常关闭码时才尝试重连
                    // 1000是正常关闭，1001是客户端主动离开，这些情况不需要重连
                    if (event.code !== 1000 && event.code !== 1001 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts));
                        reconnectAttempts++;
                        addSystemMessage(`将在 ${delay/1000} 秒后尝试重新连接...`);
                        
                        setTimeout(() => {
                            if (connectionState !== 'connecting') {
                                connectWebSocket();
                            }
                        }, delay);
                    } else if (event.code !== 1000 && event.code !== 1001) {
                        addSystemMessage('重连次数已达上限，请手动重试');
                    }
                };
                
            } catch (e) {
                console.error('[ERROR] 创建WebSocket失败:', e);
                updateStatus('错误', '#f44336');
                addSystemMessage('连接创建失败');
                handleReconnect();
            }
        }
        
        // 处理重连
        function handleReconnect() {
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts));
                reconnectAttempts++;
                addSystemMessage(`将在 ${delay/1000} 秒后尝试重新连接...`);
                setTimeout(connectWebSocket, delay);
            } else {
                addSystemMessage('重连次数已达上限，请手动重试');
            }
        }
        
        // 发送消息
        function sendMessage() {
            const message = messageInput.value.trim();
            if (!message || !socket) return;
            
            const messageId = messageCounter++;
            
            addMessage(message, 'user', 'text', messageId);
            
            const indicatorId = addTypingIndicator(messageId);
            typingIndicators[messageId] = indicatorId;
            
            // 设置消息超时检查
            const timeoutId = setTimeout(() => {
                // 检查是否在发送消息后长时间没有收到服务器响应
                const timeSinceLastResponse = Date.now() - lastServerResponseTime;
                if (timeSinceLastResponse > 60000) { // 60秒没有响应
                    console.log('[MSG TIMEOUT] 发送消息后长时间未收到回复，连接可能已失效');
                    addSystemMessage('长时间未收到回复，连接可能异常，正在重新连接...');
                    
                    // 关闭现有连接
                    if (socket) {
                        try {
                            socket.close();
                        } catch (e) {}
                        socket = null;
                    }
                    
                    reconnectAttempts = 0;
                    connectWebSocket();
                }
            }, 30000); // 30秒后检查
            
            if (socket.readyState === WebSocket.OPEN) {
                try {
                    const eventPayload = {
                        "post_type": "message",
                        "message_type": "private",
                        "sub_type": "friend",
                        "message_id": messageId,
                        "user_id": isAdminMode ? currentMasterQQ : currentUserId,
                        "self_id": botInfo.qq,
                        "message": [
                            {
                                "type": "text",
                                "data": {"text": message}
                            }
                        ],
                        "raw_message": message,
                        "font": 0,
                        "sender": {
                            "user_id": isAdminMode ? currentMasterQQ : currentUserId,
                            "nickname": isAdminMode ? "管理员" : "用户",
                            "sex": "unknown",
                            "age": 0
                        },
                        "time": Math.floor(Date.now() / 1000)
                    };
                    
                    console.log('[SEND] 发送消息事件:', eventPayload);
                    socket.send(JSON.stringify(eventPayload));
                    messageInput.value = '';
                    
                    // 更新最后发送消息时间，用于检测连接健康
                    lastHeartbeatTime = Date.now();
                } catch (e) {
                    console.error('[ERROR] 消息发送失败:', e);
                    addSystemMessage('消息发送失败');
                    clearTimeout(timeoutId);
                }
            } else {
                addSystemMessage('机器人未连接，消息发送失败');
                connectWebSocket();
                clearTimeout(timeoutId);
            }
        }
        
        // 新增：创建转发消息预览
            function addForwardMessage(messages) {
                // 创建机器人消息容器
                const messageContainer = document.createElement('div');
                messageContainer.className = 'message-container robot';
                
                // 创建机器人头像
                const avatarContainer = document.createElement('div');
                avatarContainer.className = 'avatar-container';
                
                const avatar = document.createElement('img');
                avatar.className = 'avatar-img';
                avatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
                avatarContainer.appendChild(avatar);
                messageContainer.appendChild(avatarContainer);
                
                // 创建内容容器
                const contentContainer = document.createElement('div');
                contentContainer.className = 'content-container';
                
                // 创建转发预览框
                const previewContainer = document.createElement('div');
                previewContainer.className = 'forward-preview-container';
                
                // 创建预览标题
                const previewTitle = document.createElement('div');
                previewTitle.className = 'forward-preview-title';
                previewTitle.textContent = '转发的聊天记录';
                previewContainer.appendChild(previewTitle);
                
                // 创建消息节点容器
                const nodesContainer = document.createElement('div');
                nodesContainer.className = 'forward-nodes-container';
                
                // 处理每个消息节点
                messages.forEach((node, index) => {
                    if (node.data.content.length > 0) {
                        const firstContent = node.data.content[0];
                        const nodeElement = document.createElement('div');
                        nodeElement.className = 'forward-preview-node';
                        
                        // 创建头像
                        const avatar = document.createElement('img');
                        avatar.className = 'forward-preview-avatar';
                        avatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
                        
                        // 创建文本预览
                        const textPreview = document.createElement('div');
                        textPreview.className = 'forward-preview-text';
                        if (firstContent.type === 'text') {
                            const text = firstContent.data.text;
                            const firstLine = text.split('\n')[0];
                            textPreview.textContent = firstLine;
                        } else if (firstContent.type === 'image') {
                            textPreview.textContent = '[图片]';
                        } else {
                            textPreview.textContent = `[${firstContent.type}]`;
                        }
                        
                        nodeElement.appendChild(avatar);
                        nodeElement.appendChild(textPreview);
                        nodesContainer.appendChild(nodeElement);
                    }
                });
                
                previewContainer.appendChild(nodesContainer);
                contentContainer.appendChild(previewContainer);
                messageContainer.appendChild(contentContainer);
                messageArea.appendChild(messageContainer);
                messageArea.scrollTop = messageArea.scrollHeight;
                
                // 点击预览展开详细消息
                previewContainer.addEventListener('click', () => {
                    showForwardDetail(messages);
                });
            }

            // 新增：显示转发详情弹窗
            function showForwardDetail(messages) {
                // 创建弹窗容器
                const detailModal = document.createElement('div');
                detailModal.className = 'forward-detail-modal';
                
                // 创建弹窗内容容器
                const detailContent = document.createElement('div');
                detailContent.className = 'forward-detail-content';
                
                // 创建关闭按钮
                const closeBtn = document.createElement('div');
                closeBtn.className = 'forward-detail-close';
                closeBtn.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/关闭.svg" alt="关闭">';
                closeBtn.addEventListener('click', () => {
                    document.body.removeChild(detailModal);
                });
                detailContent.appendChild(closeBtn);
                
                // 处理每个消息节点
                messages.forEach(node => {
                    // 创建节点容器
                    const nodeContainer = document.createElement('div');
                    nodeContainer.className = 'forward-detail-node';
                    
                    // 创建节点头部（头像和名字）
                    const nodeHeader = document.createElement('div');
                    nodeHeader.className = 'forward-detail-header';
                    
                    const avatar = document.createElement('img');
                    avatar.className = 'forward-detail-avatar';
                    avatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
                    
                    const name = document.createElement('span');
                    name.className = 'forward-detail-name';
                    name.textContent = node.data.name;
                    
                    nodeHeader.appendChild(avatar);
                    nodeHeader.appendChild(name);
                    nodeContainer.appendChild(nodeHeader);
                    
                    // 创建节点消息内容
                    const nodeMessages = document.createElement('div');
                    nodeMessages.className = 'forward-detail-messages';
                    
                    // 处理节点内的每条消息
                    node.data.content.forEach(contentItem => {
                        if (contentItem.type === 'text') {
                            const textBubble = document.createElement('div');
                            textBubble.className = 'message-bubble';
                            
                            // 处理换行
                            const lines = contentItem.data.text.split('\n');
                            lines.forEach((line, index) => {
                                textBubble.appendChild(document.createTextNode(line));
                                if (index < lines.length - 1) {
                                    textBubble.appendChild(document.createElement('br'));
                                }
                            });
                            
                            nodeMessages.appendChild(textBubble);
                        } else if (contentItem.type === 'image') {
                            const img = document.createElement('img');
                            img.className = 'message-image fancybox';
                            img.dataset.fancybox = "gallery";
                            
                            // 处理图片URL
                            if (contentItem.data.file.startsWith('http') || 
                                contentItem.data.file.startsWith('/') || 
                                contentItem.data.file.startsWith('./')) {
                                img.src = contentItem.data.file;
                            } else if (contentItem.data.file.startsWith('base64://')) {
                                const base64Data = contentItem.data.file.replace('base64://', '');
                                img.src = `data:image/png;base64,${base64Data}`;
                            } else {
                                console.warn('无法识别的图片格式:', contentItem.data.file);
                                img.src = '';
                            }
                            
                            nodeMessages.appendChild(img);
                        }
                    });
                    
                    nodeContainer.appendChild(nodeMessages);
                    detailContent.appendChild(nodeContainer);
                });
                
                detailModal.appendChild(detailContent);
                document.body.appendChild(detailModal);
                
                // 点击弹窗外部关闭弹窗
                detailModal.addEventListener('click', (e) => {
                    if (e.target === detailModal) {
                        document.body.removeChild(detailModal);
                    }
                });
            }
        // 初始化用户
        async function initializeUser() {
    try {
        addSystemMessage('正在初始化聊天系统...');
        
        // 首先尝试验证管理员令牌
        if (authToken) {
            addSystemMessage('检测到管理员令牌，正在验证...');
            const verifyResult = await verifyAdminToken();
            if (verifyResult.valid) {
                isAdminMode = true;
                currentMasterQQ = verifyResult.realMasterQQ;
                adminModeBadge.style.display = 'block';
                addSystemMessage(`检测到有效管理员令牌，已进入管理员模式`);
                
                // 更新按钮状态为active（已登录管理员状态）
                adminEntryButton.classList.add('admin-btn-active');
                adminEntryButton.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/17.svg" alt="管理员">';
                
                // 使用管理员身份
                userLoginForm.style.display = 'none';
                adminLoginPanel.style.display = 'none';
                chatInterface.style.display = 'flex';
                messageInputArea.style.display = 'flex';
                quickButtonsContainer.style.display = 'flex';
                tipsArea.style.display = 'flex';
                connectWebSocket();
                return;
            } else {
                addSystemMessage('管理员令牌已失效，切换到普通用户模式');
                authToken = null;
                localStorage.removeItem('auth_token');
            }
        }
        
        // 普通用户初始化
        addSystemMessage('正在初始化用户会话...');
        userLoginForm.style.display = 'flex';
        chatInterface.style.display = 'none';
        adminLoginForm.style.display = 'none';
        
        const result = await initUserSession();
        
        if (result.success) {
            addSystemMessage('正在连接到聊天服务器...');
            if (result.isNew) {
                addSystemMessage(`欢迎新用户！您的用户ID: ${result.userId}`);
            } else {
                addSystemMessage(`检测到现有会话，正在恢复...`);
                addSystemMessage(`欢迎回来！用户ID: ${result.userId}`);
            }
            
            // 更新session-id和条形码
            const sessionIdEl = document.getElementById('botInfoSessionId');
            const barcodeEl = document.getElementById('botInfoBarcode');
            if (result.userId && sessionIdEl) {
                // 检查userId是否已经有'blog-'前缀
                let displayId = result.userId;
                if (!displayId.startsWith('blog-')) {
                    // 如果没有，添加前缀（取前8个字符）
                    const shortId = displayId.substring(0, 8);
                    displayId = `blog-${shortId}`;
                }
                sessionIdEl.textContent = displayId;
                // 生成条形码
                if (barcodeEl) {
                    generateGradientBarcode(displayId, barcodeEl);
                }
            }
            
            userLoginForm.style.display = 'none';
            chatInterface.style.display = 'flex';
            messageInputArea.style.display = 'flex';
            quickButtonsContainer.style.display = 'flex';
            
            await restoreChatHistory();
            
            connectWebSocket();
            
            if (!welcomeMessageShown && !isAdminMode && messageHistory.size === 0) {
                welcomeMessageShown = true;
                setTimeout(() => {
                    const welcomeMessageId = 99999;
                    const indicatorId = addTypingIndicator(welcomeMessageId);
                    typingIndicators[welcomeMessageId] = indicatorId;
                    
                    setTimeout(() => {
                        removeTypingIndicator(welcomeMessageId);
                        delete typingIndicators[welcomeMessageId];
                        addMessage("欢迎回来~\n桃妹的原型是胡桃，直接与我对话是用大模型对话哦，可能会慢一点，请稍等就好\n更多机器人功能请点击{BlogBot-add}#帮助{/BlogBot-add}\n联系主人请点击{BlogBot-add}#联系主人{/BlogBot-add}加需要询问的信息。\n例如 #联系主人 你好我想问···", 'robot');
                    }, 2000);
                }, 1500);
            } else if (messageHistory.size > 0) {
                welcomeMessageShown = true;
            }
        } else {
            userLoginMessage.textContent = result.message || '用户初始化失败，请刷新页面重试';
        }
    } catch (error) {
        console.error('初始化失败:', error);
        addSystemMessage('初始化失败，请刷新页面重试');
        userLoginMessage.textContent = '初始化失败，请刷新页面重试';
    }
}
        
        // 管理员入口按钮点击事件
        // 在initChatSystem函数中，找到adminEntryButton的点击事件处理函数
// 修改为：

// 管理员入口按钮点击事件
adminEntryButton.addEventListener('click', () => {
    if (isAdminMode) {
        // 已登录管理员，点击退出管理员模式
        adminLogout();
        isAdminMode = false;
        currentMasterQQ = null;
        adminModeBadge.style.display = 'none';
        
        // 恢复按钮为普通状态
        adminEntryButton.classList.remove('admin-btn-active');
        adminEntryButton.innerHTML = '<img src="./assets/CodeBubbyAssets/3_356/10.svg" alt="管理员">';
        
        addSystemMessage('已退出管理员模式，切换到普通用户模式');
        
        // 重新初始化普通用户会话
        initializeUser();
    } else {
        // 未登录，显示管理员登录表单
        showAdminLoginForm();
    }
});

// 显示管理员登录表单函数
function showAdminLoginForm() {
    console.log('显示管理员登录表单');
    
    // 隐藏其他所有内容
    chatInterface.style.display = 'none';
    userLoginForm.style.display = 'none';
    messageInputArea.style.display = 'none';
    quickButtonsContainer.style.display = 'none';
    tipsArea.style.display = 'none';
    
    // 隐藏Log面板
    logPanel.style.display = 'none';
    
    // 隐藏bot-info-area
    const botInfoArea = document.querySelector('.bot-info-area');
    if (botInfoArea) {
        botInfoArea.style.display = 'none';
    }
    
    // 清空管理员输入框
    adminAccountInput.value = '';
    adminPasswordInput.value = '';
    adminPasswordInput.type = 'password';
    
    // 重置密码可见状态
    passwordToggleIcon.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/13.svg" alt="显示密码">';
    passwordToggleIcon.dataset.visible = 'false';
    
    // 重置错误消息
    adminLoginMessage.style.display = 'none';
    adminLoginMessage.textContent = '';
    
    // 重置登录按钮状态
    adminLoginButton.disabled = false;
    adminLoginButton.textContent = 'Login';
    
    // 更新头像
    adminLoginAvatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
    
    // 显示登录面板
    adminLoginPanel.style.display = 'flex';
    
    // 更新按钮状态为active
    adminEntryButton.classList.add('admin-btn-active');
    adminEntryButton.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/17.svg" alt="管理员">';
    
    // 重置log按钮状态
    logButton.classList.remove('log-btn-active');
    logButton.innerHTML = '<img src="./assets/CodeBubbyAssets/3_356/11.svg" alt="日志">';
}

// 密码可见/不可见图标切换事件
passwordToggleIcon.addEventListener('click', () => {
    const isVisible = passwordToggleIcon.dataset.visible === 'true';
    if (isVisible) {
        // 切换为不可见
        adminPasswordInput.type = 'password';
        passwordToggleIcon.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/13.svg" alt="显示密码">';
        passwordToggleIcon.dataset.visible = 'false';
    } else {
        // 切换为可见
        adminPasswordInput.type = 'text';
        passwordToggleIcon.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/14.svg" alt="隐藏密码">';
        passwordToggleIcon.dataset.visible = 'true';
    }
});

// 关闭管理员登录面板事件
adminLoginCloseBtn.addEventListener('click', () => {
    hideAdminLoginForm();
});

// 隐藏管理员登录面板函数
function hideAdminLoginForm() {
    adminLoginPanel.style.display = 'none';
    
    // 恢复按钮状态
    adminEntryButton.classList.remove('admin-btn-active');
    adminEntryButton.innerHTML = '<img src="./assets/CodeBubbyAssets/3_356/10.svg" alt="管理员">';
    
    // 显示聊天界面元素
    chatInterface.style.display = 'flex';
    messageInputArea.style.display = 'flex';
    quickButtonsContainer.style.display = 'flex';
    tipsArea.style.display = 'flex';
    
    // 显示bot-info-area
    const botInfoArea = document.querySelector('.bot-info-area');
    if (botInfoArea) {
        botInfoArea.style.display = 'flex';
    }
    
    // 重新初始化普通用户会话
    initializeUser();
}

// 添加返回普通用户界面的链接
function addReturnToUserLink() {
    // 已移除，改用关闭按钮
}

// 管理员登录失败时显示错误弹窗
function showAdminLoginError(message, duration = 5000) {
    const existingError = document.querySelector('.admin-error-popup');
    if (existingError) {
        existingError.remove();
    }
    
    const errorPopup = document.createElement('div');
    errorPopup.className = 'admin-error-popup';
    errorPopup.textContent = message;
    
    document.body.appendChild(errorPopup);
    
    setTimeout(() => {
        errorPopup.classList.add('fade-out');
        setTimeout(() => {
            if (errorPopup.parentNode) {
                errorPopup.remove();
            }
        }, 300);
    }, duration);
}

// 修改管理员登录按钮点击事件
adminLoginButton.addEventListener('click', async () => {
    const account = adminAccountInput.value.trim();
    const password = adminPasswordInput.value.trim();
    
    if (!account || !password) {
        showAdminLoginError('账号和密码不能为空');
        return;
    }
    
    adminLoginButton.disabled = true;
    adminLoginButton.textContent = '登录中...';
    adminLoginMessage.style.display = 'none';
    
    const result = await adminLogin(account, password);
    
    if (result.success) {
        // 登录成功，隐藏管理员登录面板
        adminLoginPanel.style.display = 'none';
        
        // 显示聊天界面元素
        chatInterface.style.display = 'flex';
        messageInputArea.style.display = 'flex';
        quickButtonsContainer.style.display = 'flex';
        tipsArea.style.display = 'flex';
        
        // 显示bot-info-area
        const botInfoArea = document.querySelector('.bot-info-area');
        if (botInfoArea) {
            botInfoArea.style.display = 'flex';
        }
        
        isAdminMode = true;
        currentMasterQQ = result.realMasterQQ;
        adminModeBadge.style.display = 'block';
        welcomeMessageShown = true;
        
        // 更新按钮状态为active（已登录管理员状态）
        adminEntryButton.classList.add('admin-btn-active');
        adminEntryButton.innerHTML = '<img src="./assets/CodeBubbyAssets/16_268/17.svg" alt="管理员">';
        
        // 更新条形码（管理员模式使用管理员QQ）
        const sessionIdElAdmin = document.getElementById('botInfoSessionId');
        const barcodeElAdmin = document.getElementById('botInfoBarcode');
        if (result.realMasterQQ && sessionIdElAdmin) {
            let displayId = result.realMasterQQ;
            if (!displayId.startsWith('blog-')) {
                const shortId = displayId.substring(0, 8);
                displayId = `blog-${shortId}`;
            }
            sessionIdElAdmin.textContent = displayId;
            if (barcodeElAdmin) {
                generateGradientBarcode(displayId, barcodeElAdmin);
            }
        }
        
        addSystemMessage('管理员登录成功！');
        addSystemMessage(`检测到有效管理员令牌，已进入管理员模式`);
        
        // 连接WebSocket
        connectWebSocket();
    } else {
        // 登录失败，显示错误
        showAdminLoginError(result.message || '账号或密码错误');
        adminLoginButton.textContent = 'Login';
        adminLoginButton.disabled = false;
    }
});
        
        // 发送按钮点击事件
        sendButton.addEventListener('click', sendMessage);
        
        // 输入框回车事件
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // 聊天图标点击事件
        chatIcon.addEventListener('click', () => {
            const isVisible = chatWindow.style.display === 'flex';
            chatIcon.style.transform = isVisible ? 'none' : 'rotate(15deg)';
            chatWindow.style.display = isVisible ? 'none' : 'flex';
            
            if (!isVisible) {
                bubbleTip.style.display = 'none';
                bubbleVisible = false;
                
                // 聊天窗口显示时更新快捷按钮可见性
                setTimeout(updateQuickButtonsVisibility, 50);
                
                if (!isInitialized) {
                    isInitialized = true;
                    initializeUser();
                }
            }
        });
        
        // 初始化调整大小功能
        function initResize() {
            let isResizing = false;
            let resizeCorner = null;
            let startX, startY, startWidth, startHeight, startLeft, startTop;
            
            const corners = ['tl', 'tr', 'bl', 'br'];
            corners.forEach(pos => {
                const corner = document.createElement('div');
                corner.className = `resize-corner resize-${pos}`;
                
                chatWindow.appendChild(corner);
                
                corner.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    isResizing = true;
                    resizeCorner = pos;
                    
                    startX = e.clientX;
                    startY = e.clientY;
                    startWidth = parseInt(getComputedStyle(chatWindow).width, 10);
                    startHeight = parseInt(getComputedStyle(chatWindow).height, 10);
                    startLeft = parseInt(getComputedStyle(chatWindow).left, 10) || 0;
                    startTop = parseInt(getComputedStyle(chatWindow).top, 10) || 0;
                    
                    function handleMouseMove(e) {
                        if (!isResizing) return;
                        
                        const deltaX = e.clientX - startX;
                        const deltaY = e.clientY - startY;
                        
                        switch(resizeCorner) {
                            case 'tl':
                                chatWindow.style.width = Math.max(300, startWidth - deltaX) + 'px';
                                chatWindow.style.height = Math.max(300, startHeight - deltaY) + 'px';
                                chatWindow.style.left = (startLeft + deltaX) + 'px';
                                chatWindow.style.top = (startTop + deltaY) + 'px';
                                break;
                            case 'tr':
                                chatWindow.style.width = Math.max(300, startWidth + deltaX) + 'px';
                                chatWindow.style.height = Math.max(300, startHeight - deltaY) + 'px';
                                chatWindow.style.top = (startTop + deltaY) + 'px';
                                break;
                            case 'bl':
                                chatWindow.style.width = Math.max(300, startWidth - deltaX) + 'px';
                                chatWindow.style.height = Math.max(300, startHeight + deltaY) + 'px';
                                chatWindow.style.left = (startLeft + deltaX) + 'px';
                                break;
                            case 'br':
                                chatWindow.style.width = Math.max(300, startWidth + deltaX) + 'px';
                                chatWindow.style.height = Math.max(300, startHeight + deltaY) + 'px';
                                break;
                        }
                    }
                    
                    function stopResize() {
                        isResizing = false;
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', stopResize);
                        // 调整大小完成后更新按钮可见性
                        updateQuickButtonsVisibility();
                    }
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', stopResize);
                });
            });
            
            // 拖动窗口
            const header = chatWindow.querySelector('.chat-header');
            let isDragging = false;
            let dragStartX, dragStartY, dragStartLeft, dragStartTop;
            
            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('.admin-entry-button') || e.target.closest('#statusIndicator')) {
                    return;
                }
                
                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                dragStartLeft = parseInt(getComputedStyle(chatWindow).left, 10) || 0;
                dragStartTop = parseInt(getComputedStyle(chatWindow).top, 10) || 0;
                
                function handleDragMove(e) {
                    if (!isDragging) return;
                    
                    const deltaX = e.clientX - dragStartX;
                    const deltaY = e.clientY - dragStartY;
                    
                    chatWindow.style.left = (dragStartLeft + deltaX) + 'px';
                    chatWindow.style.top = (dragStartTop + deltaY) + 'px';
                }
                
                function stopDragging() {
                    isDragging = false;
                    document.removeEventListener('mousemove', handleDragMove);
                    document.removeEventListener('mouseup', stopDragging);
                }
                
                document.addEventListener('mousemove', handleDragMove);
                document.addEventListener('mouseup', stopDragging);
            });
        }
        
        // 初始化调整大小功能
        initResize();
        
        // 初始化聊天系统
        initializeUser();

        // 初始化GLightbox
        setTimeout(() => {
            initGLightbox();
        }, 500);
        
        // ==================== 页面可见性和休眠恢复机制 ====================
        
        /**
         * 检查WebSocket连接是否真正健康
         * 不仅检查readyState，还检查最近是否有通信
         */
        function isConnectionTrulyHealthy() {
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                return false;
            }
            return connectionHealthy;
        }
        
        /**
         * 简化的连接健康验证
         * 只检查基本状态，不做复杂的心跳验证
         */
        function verifyConnectionHealth() {
            return new Promise((resolve) => {
                if (!socket || socket.readyState !== WebSocket.OPEN) {
                    resolve(false);
                    return;
                }
                
                // 如果连接状态显示为OPEN，尝试发送心跳
                try {
                    sendHeartbeat();
                    // 发送成功，认为连接健康
                    connectionHealthy = true;
                    lastHeartbeatTime = Date.now();
                    resolve(true);
                } catch (e) {
                    console.log('[HEALTH] 心跳发送失败:', e);
                    connectionHealthy = false;
                    resolve(false);
                }
            });
        }
        
        /**
         * 处理页面从休眠中恢复
         * 优化：只有当页面真正被长时间休眠时才强制重连
         */
        async function handlePageWakeUp() {
            const now = Date.now();
            const sleepDuration = now - lastActiveTime;
                    
            console.log(`[WAKEUP] 页面恢复，休眠时长: ${Math.round(sleepDuration / 1000)}秒`);
                    
            // 如果休眠超过60秒，才强制重连
            // 这样可以避免用户只是切换到其他标签页或窗口时的频繁重连
            if (sleepDuration > 60000) {
                addSystemMessage('检测到页面曾被长时间休眠，正在重新连接...');
                        
                // 关闭现有连接（无论状态如何）
                if (socket) {
                    try {
                        console.log('[WAKEUP] 关闭旧连接...');
                        socket.close();
                    } catch (e) {
                        console.log('[WAKEUP] 关闭旧连接时出错:', e);
                    }
                    socket = null;
                }
                        
                // 停止旧的心跳
                stopHeartbeat();
                        
                // 重置连接状态
                connectionHealthy = false;
                reconnectAttempts = 0;
                        
                // 延迟一小段时间后重连，确保旧连接完全关闭
                setTimeout(() => {
                    console.log('[WAKEUP] 开始重新连接...');
                    connectWebSocket();
                }, 500);
            } else if (sleepDuration > 5000) {
                // 短时间休眠（5-60秒），只检查连接状态，不强制重连
                console.log('[WAKEUP] 短时间休眠，检查连接状态...');
                if (socket && socket.readyState === WebSocket.OPEN) {
                    try {
                        sendHeartbeat();
                        console.log('[WAKEUP] 发送心跳验证连接状态');
                    } catch (e) {
                        console.log('[WAKEUP] 心跳发送失败，连接可能已失效');
                        addSystemMessage('连接异常，正在重新连接...');
                        
                        // 关闭现有连接
                        if (socket) {
                            try {
                                socket.close();
                            } catch (e) {}
                            socket = null;
                        }
                        
                        reconnectAttempts = 0;
                        connectWebSocket();
                    }
                }
            }
                    
            lastActiveTime = now;
        }
        
        /**
         * 页面可见性变化处理
         * 优化：只有当页面真正被隐藏较长时间后才处理
         */
        function handleVisibilityChange() {
            const wasVisible = isPageVisible;
            isPageVisible = !document.hidden;
            
            console.log(`[VISIBILITY] 页面可见性变化: ${wasVisible ? '可见' : '隐藏'} -> ${isPageVisible ? '可见' : '隐藏'}`);
            
            if (isPageVisible && !wasVisible) {
                // 页面从隐藏变为可见，可能是从休眠中恢复
                // 但不要立即处理，先记录当前时间
                // 因为用户可能只是快速切换标签页
                setTimeout(() => {
                    if (isPageVisible) {
                        handlePageWakeUp();
                    }
                }, 1000); // 延迟1秒处理，避免快速切换标签页时的误触发
            } else if (!isPageVisible && wasVisible) {
                // 页面即将隐藏，记录当前时间
                lastActiveTime = Date.now();
                console.log('[VISIBILITY] 页面即将隐藏，记录时间戳');
            }
        }
        
        /**
         * 处理页面被freeze/resume的情况 (Page Lifecycle API)
         */
        function handlePageFreeze() {
            console.log('[LIFECYCLE] 页面被冻结');
            lastActiveTime = Date.now();
        }
        
        function handlePageResume() {
            console.log('[LIFECYCLE] 页面从冻结中恢复');
            handlePageWakeUp();
        }
        
        /**
         * 定期检查连接健康状态
         * 优化：降低检查频率，减少误触发
         */
        function startConnectionMonitor() {
            // 每2分钟检查一次连接健康状态
            setInterval(() => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    // 检查是否长时间没有收到服务器响应
                    const now = Date.now();
                    const timeSinceLastResponse = now - lastServerResponseTime;
                    
                    // 如果超过90秒没有收到服务器响应，才认为连接可能已失效
                    if (timeSinceLastResponse > 90000) {
                        console.log('[MONITOR] 长时间未收到服务器响应，连接可能已失效，发送心跳确认');
                        try {
                            sendHeartbeat();
                            console.log('[MONITOR] 发送心跳验证连接状态');
                        } catch (e) {
                            console.log('[MONITOR] 心跳发送失败，连接已失效');
                            addSystemMessage('连接异常，正在重新连接...');
                            
                            // 关闭现有连接
                            if (socket) {
                                try {
                                    socket.close();
                                } catch (e) {}
                                socket = null;
                            }
                            
                            reconnectAttempts = 0;
                            connectWebSocket();
                        }
                    }
                }
            }, 120000); // 每2分钟检查一次
            
            console.log('[MONITOR] 连接健康监控已启动');
        }
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // 监听Page Lifecycle API事件（如果浏览器支持）
        if ('onfreeze' in document) {
            document.addEventListener('freeze', handlePageFreeze);
            document.addEventListener('resume', handlePageResume);
        }
        
        // 监听页面焦点变化（作为补充）
        window.addEventListener('focus', () => {
            console.log('[FOCUS] 窗口获得焦点');
            if (!isPageVisible) {
                isPageVisible = true;
                handlePageWakeUp();
            }
            
            // 页面获得焦点时，检查连接是否健康
            if (socket && socket.readyState === WebSocket.OPEN) {
                const now = Date.now();
                const timeSinceLastResponse = now - lastServerResponseTime;
                
                // 如果超过60秒没有收到服务器响应，才发送心跳确认连接
                // 这样可以避免用户只是短暂切换窗口时的频繁检查
                if (timeSinceLastResponse > 60000) {
                    console.log('[FOCUS] 页面获得焦点，长时间未收到响应，发送心跳确认');
                    try {
                        sendHeartbeat();
                        console.log('[FOCUS] 发送心跳验证连接状态');
                    } catch (e) {
                        console.log('[FOCUS] 心跳发送失败，连接可能已失效');
                        addSystemMessage('连接异常，正在重新连接...');
                        
                        // 关闭现有连接
                        if (socket) {
                            try {
                                socket.close();
                            } catch (e) {}
                            socket = null;
                        }
                        
                        reconnectAttempts = 0;
                        connectWebSocket();
                    }
                }
            }
        });
        
        window.addEventListener('blur', () => {
            console.log('[FOCUS] 窗口失去焦点');
            lastActiveTime = Date.now();
        });
        
        // 监听页面在线/离线状态
        window.addEventListener('online', () => {
            console.log('[NETWORK] 网络已恢复');
            addSystemMessage('网络连接已恢复');
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                reconnectAttempts = 0;
                connectWebSocket();
            }
        });
        
        window.addEventListener('offline', () => {
            console.log('[NETWORK] 网络已断开');
            addSystemMessage('网络连接已断开');
            updateStatus('离线', '#ff4d4d');
            connectionHealthy = false;
        });
        
        // 启动连接监控
        startConnectionMonitor();
        
        console.log('[INIT] 页面可见性和休眠恢复机制已初始化');
    }
    
    // 初始化聊天系统
    initChatSystem();
});
