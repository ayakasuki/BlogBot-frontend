// 加载外部 CSS 文件
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = './BlogBot.css';  // 请根据实际情况修改路径
link.type = 'text/css';
link.onload = () => console.log('[CSS] 外部样式加载成功');
link.onerror = () => console.warn('[CSS] 外部样式加载失败，使用内联样式');
document.head.appendChild(link);

document.addEventListener('DOMContentLoaded', () => {
    // 获取当前执行的script标签
    const currentScript = document.currentScript || 
      document.querySelector('script[src*="BlogBot.js"]');
    
    // 从data属性读取安全参数
    const config = {
      AUTH_API_URL: currentScript.dataset.authApiUrl
    };
  
    // 使用配置参数
    const CHAT_ICON_SVG = './taomei_icon_120px.webp';
    
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
    
    function initChatSystem() {
        // 头部区域
        const header = document.createElement('div');
        header.className = 'chat-header';
        
        const titleContainer = document.createElement('div');
        titleContainer.className = 'header-title-container';
        
        const title = document.createElement('h3');
        title.textContent = `这是你的${botInfo.name || '机器人'}呀~`;
        titleContainer.appendChild(title);
        
        header.appendChild(titleContainer);
        
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'statusIndicator';
        statusIndicator.textContent = '● 离线';
        
        const adminEntryButton = document.createElement('div');
        adminEntryButton.className = 'admin-entry-button';
        adminEntryButton.innerHTML = '管理入口';
        adminEntryButton.title = '点击进入管理员登录界面';
        
        const headerControls = document.createElement('div');
        headerControls.className = 'header-controls';
        headerControls.appendChild(statusIndicator);
        headerControls.appendChild(adminEntryButton);
        
        header.appendChild(headerControls);
        
        // ==================== 系统消息横幅区域 ====================
        const systemMsgBanner = document.createElement('div');
        systemMsgBanner.className = 'chat-systemmsg-banner';
        systemMsgBanner.innerHTML = '<span class="systemmsg-text">欢迎使用聊天系统</span><span class="systemmsg-expand">展开</span>';
        
        // 系统消息历史记录
        const systemMsgHistory = [];
        
        // 系统消息详情弹窗
        const systemMsgModal = document.createElement('div');
        systemMsgModal.className = 'systemmsg-modal';
        systemMsgModal.style.display = 'none';
        
        const systemMsgModalContent = document.createElement('div');
        systemMsgModalContent.className = 'systemmsg-modal-content';
        
        const systemMsgModalHeader = document.createElement('div');
        systemMsgModalHeader.className = 'systemmsg-modal-header';
        systemMsgModalHeader.innerHTML = '<span>系统消息历史</span><span class="systemmsg-modal-close">×</span>';
        
        const systemMsgModalList = document.createElement('div');
        systemMsgModalList.className = 'systemmsg-modal-list';
        
        systemMsgModalContent.appendChild(systemMsgModalHeader);
        systemMsgModalContent.appendChild(systemMsgModalList);
        systemMsgModal.appendChild(systemMsgModalContent);
        
        // 点击横幅展开详情
        systemMsgBanner.addEventListener('click', () => {
            // 更新弹窗内容
            systemMsgModalList.innerHTML = '';
            systemMsgHistory.forEach((msg, index) => {
                const item = document.createElement('div');
                item.className = 'systemmsg-item';
                item.innerHTML = `<span class="systemmsg-time">${msg.time}</span><span class="systemmsg-content">${msg.text}</span>`;
                systemMsgModalList.appendChild(item);
            });
            systemMsgModal.style.display = 'flex';
        });
        
        // 关闭弹窗
        systemMsgModalHeader.querySelector('.systemmsg-modal-close').addEventListener('click', (e) => {
            e.stopPropagation();
            systemMsgModal.style.display = 'none';
        });
        
        systemMsgModal.addEventListener('click', (e) => {
            if (e.target === systemMsgModal) {
                systemMsgModal.style.display = 'none';
            }
        });
        
        // 消息区域
        const messageArea = document.createElement('div');
        messageArea.id = 'messageArea';
        
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
        
        // 管理员登录表单
        const adminLoginForm = document.createElement('div');
        adminLoginForm.className = 'admin-login-form';
        adminLoginForm.style.display = 'none';
        
        const adminLoginTitle = document.createElement('h4');
        adminLoginTitle.className = 'admin-login-title';
        adminLoginTitle.textContent = '管理员登录';
        adminLoginForm.appendChild(adminLoginTitle);
        
        const adminAccountInput = document.createElement('input');
        adminAccountInput.className = 'admin-input';
        adminAccountInput.placeholder = '超管账号';
        adminAccountInput.id = 'adminAccountInput';
        adminAccountInput.type = 'text';
        
        const adminPasswordInput = document.createElement('input');
        adminPasswordInput.type = 'password';
        adminPasswordInput.className = 'admin-input';
        adminPasswordInput.placeholder = '超管密码';
        adminPasswordInput.id = 'adminPasswordInput';
        
        const adminLoginButton = document.createElement('button');
        adminLoginButton.className = 'admin-login-button';
        adminLoginButton.textContent = '管理员登录';
        
        const adminLoginMessage = document.createElement('div');
        adminLoginMessage.className = 'admin-login-message';
        adminLoginMessage.textContent = '请输入超管账号和密码以进行管理员登录';
        
        adminLoginForm.appendChild(adminAccountInput);
        adminLoginForm.appendChild(adminPasswordInput);
        adminLoginForm.appendChild(adminLoginButton);
        adminLoginForm.appendChild(adminLoginMessage);
        
        // 聊天界面（简化为仅显示机器人头像）
        const chatInterface = document.createElement('div');
        chatInterface.className = 'chat-interface';
        chatInterface.style.display = 'none';
        
        const botAvatarContainer = document.createElement('div');
        botAvatarContainer.className = 'bot-avatar-container';
        
        const botAvatar = document.createElement('img');
        botAvatar.className = 'bot-avatar';
        botAvatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
        botAvatar.alt = `${botInfo.name || '机器人'}头像`;
        
        botAvatarContainer.appendChild(botAvatar);
        chatInterface.appendChild(botAvatarContainer);
        
        // 输入区域
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        inputGroup.style.display = 'none';
        
        const messageInput = document.createElement('input');
        messageInput.className = 'message-input';
        messageInput.placeholder = '发送消息给机器人...';
        messageInput.id = 'chatMessageInput';
        messageInput.name = 'message';
        messageInput.autocomplete = 'off';
        
        const sendButton = document.createElement('button');
        sendButton.className = 'send-button';
        sendButton.textContent = '发送';
        
        const adminModeBadge = document.createElement('div');
        adminModeBadge.className = 'admin-mode-badge';
        adminModeBadge.textContent = '管理员模式';
        adminModeBadge.style.display = 'none';
        
        inputGroup.appendChild(messageInput);
        inputGroup.appendChild(sendButton);
        inputGroup.appendChild(adminModeBadge);
        
        // ==================== 快捷按钮容器 ====================
        const quickButtonsContainer = document.createElement('div');
        quickButtonsContainer.className = 'quick-buttons-container';
        
        // 快捷按钮配置
        const quickButtons = [
          { text: '你好，你是谁', message: '你好，你是谁' },
          { text: '推荐几篇博客文章', message: '推荐几篇博客文章' },
          { text: '2026互联网热梗', message: '网络搜索2026互联网热梗' }
        ];
        
        quickButtons.forEach((btn, index) => {
          const button = document.createElement('button');
          button.className = 'quick-button';
          button.textContent = btn.text;
          button.title = btn.text;
          button.dataset.message = btn.message;
          
          // 点击发送消息
          button.addEventListener('click', () => {
            const message = button.dataset.message;
            if (message && socket && socket.readyState === WebSocket.OPEN) {
              console.log('[QUICK] 点击快捷按钮:', message);
              
              // 添加到输入框并发送
              messageInput.value = message;
              sendMessage();
            } else {
              console.warn('[QUICK] 无法发送消息:', { hasSocket: !!socket, readyState: socket?.readyState });
            }
          });
          
          quickButtonsContainer.appendChild(button);
        });
        
        // 创建更多按钮
        const Buttom_More_SVG = './more.svg';
        const moreButton = document.createElement('button');
        moreButton.className = 'more-button';
        moreButton.innerHTML = `<img src="${Buttom_More_SVG}" alt="更多" style="width: 18px; height: 18px;">`;
        moreButton.style.display = 'none'; // 初始隐藏
        quickButtonsContainer.appendChild(moreButton);
        
        // 创建更多按钮提示
        const moreButtonTooltip = document.createElement('div');
        moreButtonTooltip.className = 'more-button-tooltip';
        moreButtonTooltip.textContent = '更多';
        document.body.appendChild(moreButtonTooltip);
        
        // 创建下拉菜单（添加到body以避免被overflow裁剪）
        const moreButtonDropdown = document.createElement('div');
        moreButtonDropdown.className = 'more-button-dropdown';
        document.body.appendChild(moreButtonDropdown);
        
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
          
          // 计算下拉菜单位置（显示在按钮左上方，右下角对准按钮左上角）
          const dropdownTop = rect.top - moreButtonDropdown.offsetHeight;
          const dropdownLeft = rect.left - moreButtonDropdown.offsetWidth;
          
          moreButtonDropdown.style.top = (dropdownTop - 50) + 'px';
          moreButtonDropdown.style.left = (dropdownLeft - 110) + 'px';
          moreButtonDropdown.style.right = 'auto'; // 覆盖CSS中的right属性
          
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
          const containerWidth = quickButtonsContainer.clientWidth - 40; // 减去更多按钮的宽度
          const buttons = Array.from(quickButtonsContainer.querySelectorAll('.quick-button'));
          
          let totalWidth = 0;
          let visibleCount = 0;
          
          // 清空下拉菜单
          moreButtonDropdown.innerHTML = '';
          
          buttons.forEach((btn, index) => {
            const buttonWidth = btn.offsetWidth;
            
            if (totalWidth + buttonWidth <= containerWidth) {
              // 显示能容纳的按钮
              btn.style.display = 'block';
              btn.style.visibility = 'visible';
              totalWidth += buttonWidth;
              visibleCount++;
            } else {
              // 隐藏超出宽度的按钮
              btn.style.visibility = 'hidden';
              btn.style.display = 'none';
              
              // 添加到下拉菜单
              const dropdownBtn = btn.cloneNode(true);
              dropdownBtn.style.display = 'block';
              dropdownBtn.style.visibility = 'visible';
              
              // 为下拉菜单中的按钮添加点击事件
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
          
          // 显示或隐藏更多按钮
          const hasHiddenButtons = buttons.some(btn => btn.style.display === 'none');
          if (hasHiddenButtons) {
            moreButton.style.display = 'flex';
          } else {
            moreButton.style.display = 'none';
            moreButtonDropdown.classList.remove('show');
          }
          
          // 确保至少第一个按钮可见
          if (buttons.length > 0 && visibleCount === 0) {
            buttons[0].style.display = 'block';
            buttons[0].style.visibility = 'visible';
          }
        }
        
        // 初始化和窗口大小改变时更新
        window.addEventListener('resize', updateQuickButtonsVisibility);
        
        // 添加所有元素到窗口
        chatWindow.appendChild(header);
        chatWindow.appendChild(systemMsgBanner);
        chatWindow.appendChild(messageArea);
        messageArea.appendChild(userLoginForm);
        messageArea.appendChild(adminLoginForm);
        messageArea.appendChild(chatInterface);
        messageArea.appendChild(systemMsgModal);
        chatWindow.appendChild(quickButtonsContainer);  // 添加在 input-group 上方
        chatWindow.appendChild(inputGroup);
        
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
            statusIndicator.innerHTML = `● ${text}`;
            statusIndicator.style.color = color;
            connectionState = text.toLowerCase();
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
            
            // 更新横幅显示最新消息
            const textSpan = systemMsgBanner.querySelector('.systemmsg-text');
            textSpan.textContent = text;
            
            // 添加动画效果
            textSpan.classList.remove('systemmsg-animate');
            void textSpan.offsetWidth; // 触发重绘
            textSpan.classList.add('systemmsg-animate');
            
            // 更新展开按钮显示数量
            const expandSpan = systemMsgBanner.querySelector('.systemmsg-expand');
            expandSpan.textContent = `展开(${systemMsgHistory.length})`;
            
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
                            // 更新聊天窗口标题
                            const title = header.querySelector('h3');
                            if (title) {
                                title.textContent = `这是你的${botInfo.name || '机器人'}呀~`;
                            }
                            // 更新机器人头像
                            const botAvatar = document.querySelector('.bot-avatar');
                            if (botAvatar) {
                                botAvatar.src = `https://q.qlogo.cn/g?b=qq&s=0&nk=${botInfo.qq || '0'}`;
                                botAvatar.alt = `${botInfo.name || '机器人'}头像`;
                            }
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
                
                // 使用管理员身份
                userLoginForm.style.display = 'none';
                adminLoginForm.style.display = 'none';
                chatInterface.style.display = 'flex';
                inputGroup.style.display = 'flex';
                quickButtonsContainer.style.display = 'flex';  // 显示快捷按钮
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
            
            userLoginForm.style.display = 'none';
            chatInterface.style.display = 'flex';
            inputGroup.style.display = 'flex';
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
        adminLogout();
        isAdminMode = false;
        currentMasterQQ = null;
        adminModeBadge.style.display = 'none';
        addSystemMessage('已退出管理员模式，切换到普通用户模式');
        
        // 重新初始化普通用户会话
        initializeUser();
    } else {
        // 显示管理员登录表单
        showAdminLoginForm();
    }
});

// 显示管理员登录表单函数
function showAdminLoginForm() {
    console.log('显示管理员登录表单');
    
    // 1. 首先清除所有现有的系统消息
    const systemMessages = messageArea.querySelectorAll('.system-message');
    systemMessages.forEach(msg => msg.remove());
    
    // 2. 隐藏其他所有内容
    chatInterface.style.display = 'none';
    userLoginForm.style.display = 'none';
    inputGroup.style.display = 'none';
    
    // 3. 清除消息区域中除了管理员登录表单之外的所有内容
    const messages = messageArea.querySelectorAll('.message-container');
    messages.forEach(msg => msg.remove());
    
    // 4. 将滚动条重置到顶部
    messageArea.scrollTop = 0;
    
    // 5. 显示管理员登录表单，添加特殊类用于样式控制
    adminLoginForm.style.display = 'flex';
    adminLoginForm.classList.add('admin-form-active');
    
    // 6. 清空管理员输入框
    adminAccountInput.value = '';
    adminPasswordInput.value = '';
    adminLoginMessage.textContent = '请输入超管账号和密码以进行管理员登录';
    adminLoginMessage.style.color = '#666';
    
    // 7. 重置管理员登录按钮状态
    adminLoginButton.disabled = false;
    adminLoginButton.textContent = '管理员登录';
    
    // 8. 添加返回链接
    addReturnToUserLink();
}

// 添加返回普通用户界面的链接
function addReturnToUserLink() {
    // 移除已存在的返回链接
    const existingLink = document.querySelector('.switch-to-user-link');
    if (existingLink) {
        existingLink.remove();
    }
    
    const returnLink = document.createElement('div');
    returnLink.className = 'switch-to-user-link';
    returnLink.textContent = '← 返回普通用户界面';
    
    returnLink.addEventListener('click', () => {
        // 重新初始化普通用户会话
        adminLoginForm.style.display = 'none';
        adminLoginForm.classList.remove('admin-form-active');
        initializeUser();
    });
    
    // 将返回链接添加到管理员登录表单的底部
    const adminLoginMessage = document.querySelector('.admin-login-message');
    if (adminLoginMessage) {
        adminLoginForm.insertBefore(returnLink, adminLoginMessage.nextSibling);
    } else {
        adminLoginForm.appendChild(returnLink);
    }
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
    adminLoginMessage.textContent = '正在验证管理员身份...';
    adminLoginMessage.style.color = '#666';
    
    const result = await adminLogin(account, password);
    
    if (result.success) {
        // 登录成功，隐藏管理员登录表单
        adminLoginForm.style.display = 'none';
        adminLoginForm.classList.remove('admin-form-active');
        
        // 清除返回链接
        const returnLink = document.querySelector('.switch-to-user-link');
        if (returnLink) {
            returnLink.remove();
        }
        
        // 显示聊天界面
        chatInterface.style.display = 'flex';
        isAdminMode = true;
        currentMasterQQ = result.realMasterQQ;
        adminModeBadge.style.display = 'block';
        welcomeMessageShown = true; // 管理员模式下不显示欢迎消息
        
        addSystemMessage('管理员登录成功！');
        addSystemMessage(`检测到有效管理员令牌，已进入管理员模式`);
        
        // 显示输入框
        inputGroup.style.display = 'flex';
        
        // 连接WebSocket
        connectWebSocket();
    } else {
        // 登录失败，显示错误弹窗
        showAdminLoginError(result.message || '账号或密码错误');
        adminLoginButton.textContent = '管理员登录';
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
