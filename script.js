// Global variable to hold all KB data
let knowledgeData = [];

// --- MARKDOWN AND EDITING UTILITIES ---

/**
 * Decodes common HTML entities back into their original characters.
 * @param {string} text The string containing HTML entities.
 * @returns {string} The decoded string.
 */
function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    
    // Replace &nbsp; with a standard space before decoding
    let decodedText = text.replace(/&nbsp;/g, ' ');
    
    // Set the HTML content with the entities
    textarea.innerHTML = decodedText;
    
    // Get the decoded text
    decodedText = textarea.value;
    
    // Explicitly handle other common entities
    decodedText = decodedText.replace(/&lt;/g, '<');
    decodedText = decodedText.replace(/&gt;/g, '>');
    decodedText = decodedText.replace(/&amp;/g, '&');
    
    return decodedText;
}

/**
 * Converts basic Markdown (bold, italics) and preserves newlines as <br> tags.
 * @param {string} rawContent The raw text string from the JSON.
 * @returns {string} The formatted HTML string.
 */
function formatContent(rawContent) {
    if (!rawContent) return '';

    let formatted = rawContent;

    // 1. Convert Newlines to HTML breaks (<br>)
    // This also handles the div structure output from some editors
    formatted = formatted.replace(/\n/g, '<br>');

    // 2. Simple Markdown Conversions

    // Convert **bold** (or __bold__) to <strong>
    formatted = formatted.replace(/\*\*([^\*]+)\*\*|__([^_]+)__/g, '<strong>$1$2</strong>');
    

    return formatted;
}

/**
 * Converts the innerHTML of an edited element back into Markdown/JSON-safe format.
 */
function convertHtmlToMarkdown(htmlContent) {
    if (!htmlContent) return '';
    
    // 1. Decode any unwanted HTML entities
    let markdown = decodeHtmlEntities(htmlContent);

    // 2. Convert HTML tags back to Markdown/Source format
    
    // Convert <strong> or <b> to **
    markdown = markdown.replace(/<\s*strong\s*>(.*?)<\s*\/\s*strong\s*>/gi, '**$1**');
    markdown = markdown.replace(/<\s*b\s*>(.*?)<\s*\/\s*b\s*>/gi, '**$1**');
    
    // Convert <em> or <i> to *
    markdown = markdown.replace(/<\s*em\s*>(.*?)<\s*\/\s*em\s*>/gi, '*$1*');
    markdown = markdown.replace(/<\s*i\s*>(.*?)<\s*\/\s*i\s*>/gi, '*$1*');

    // Convert <br> tags to newlines (\\n)
    markdown = markdown.replace(/<\s*br\s*[\/]?>/gi, '\\n');

    // 3. Clean up & JSON Escaping
    
    // Escape double quotes (") for safe insertion back into the JSON string
    markdown = markdown.replace(/"/g, '\\"'); 
    
    // Remove leading/trailing newlines and whitespace
    markdown = markdown.trim();

    return markdown;
}


// --- EDITING FEATURE IMPLEMENTATION ---

function toggleEditMode() {
    const isEditing = document.body.classList.toggle('kb-editing-mode');
    
    const editableElements = document.querySelectorAll(
        '#detail-title, #detail-content, #article-list-title, .category-card h3'
    );
    
    editableElements.forEach(el => {
        el.contentEditable = isEditing;
        if (isEditing) {
            el.title = "Editing Mode: Click to type, copy and paste content if needed.";
        } else {
            el.title = "";
        }
    });

    const copyBtn = document.getElementById('copy-markdown-btn');
    const isDetailViewVisible = document.getElementById('article-detail') && !document.getElementById('article-detail').classList.contains('hidden');

    if (copyBtn) {
        // Show the copy button if editing is ON AND the detail view is currently visible
        copyBtn.classList.toggle('hidden', !(isEditing && isDetailViewVisible));
    }

    const message = isEditing 
        ? "✅ Editing Mode ENABLED! You can click and edit the article titles and content. Changes are NOT saved."
        : "❌ Editing Mode DISABLED.";
    
    console.log(`Knowledge Base Editor: ${message}`);
    alert(message);
}

function copyContentAsMarkdown(articleId) {
    const contentElement = document.getElementById('detail-content');
    
    const htmlContent = contentElement.innerHTML;
    const markdownContent = convertHtmlToMarkdown(htmlContent);
    
    navigator.clipboard.writeText(markdownContent).then(() => {
        alert(`Content (ID: ${articleId}) copied to clipboard in Markdown/JSON format!\n\nPaste this content back into your 'knowledgebase.json' file.`);
        console.log("Copied Markdown Content:", markdownContent);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy content. Check the console for errors.');
    });
}

// Attach the function to a global object (kb) for easy console access
window.kb = {
    toggleEditMode: toggleEditMode
};


// --- CORE UTILITY FUNCTIONS ---

// Gets all articles in a flat array for easy searching/lookup
function getAllArticles(data) {
    return data.flatMap(cat => 
        cat.subcategories.flatMap(sub => 
            sub.articles.map(art => ({
                ...art,
                categoryTitle: cat.categoryTitle, 
                categorySlug: cat.categorySlug,
                subcategoryTitle: sub.subcategoryTitle,
                subcategorySlug: sub.subcategorySlug    
            }))
        )
    );
}

// Controls which main view is visible, and handles back button visibility
function setView(viewId) {
    const contentViews = ['kb-categories', 'article-list', 'article-detail', 'search-results'];
    const backToCategoriesBtn = document.getElementById('back-to-categories');
    const backToPreviousBtn = document.getElementById('back-to-previous');
    const copyBtn = document.getElementById('copy-markdown-btn');
    const isEditing = document.body.classList.contains('kb-editing-mode');

    contentViews.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (id === viewId) {
                element.classList.remove('hidden'); 
            } else {
                element.classList.add('hidden');
            }
        }
    });

    // Handle back button visibility
    if (viewId === 'kb-categories') {
        backToCategoriesBtn.classList.add('hidden');
        backToPreviousBtn.classList.add('hidden');
    } else if (viewId === 'article-list' || viewId === 'search-results') {
        backToCategoriesBtn.classList.remove('hidden');
        backToPreviousBtn.classList.add('hidden');
    } else if (viewId === 'article-detail') {
        backToCategoriesBtn.classList.add('hidden');
        backToPreviousBtn.classList.remove('hidden');
    }
    
    // Manage copy button visibility (Only show if editing is ON AND the detail view is visible)
    if (copyBtn) {
        copyBtn.classList.toggle('hidden', !(isEditing && viewId === 'article-detail'));
    }
    
    console.log(`View set to: ${viewId}`);
}


// --- RENDERING FUNCTIONS ---

function renderCategories(data) {
    const container = document.getElementById('kb-categories');
    
    if (!container) {
        console.error("Fatal Error: Could not find the 'kb-categories' element.");
        return;
    }

    // Clear only the dynamically inserted cards (keep the static H2 title)
    container.querySelectorAll('.category-card').forEach(card => card.remove());

    data.forEach(category => {
        const categoryElement = document.createElement('div');
        categoryElement.className = 'category-card';
        
        // Calculate total articles by checking subcategories
        const totalArticles = category.subcategories.reduce((sum, sub) => sum + sub.articles.length, 0); 

        categoryElement.innerHTML = `
            <h3>${category.categoryTitle}</h3>
            <p>${category.subcategories.length} sub-topics, ${totalArticles} articles</p>
        `;
        
        categoryElement.addEventListener('click', () => {
            history.pushState(null, '', `index.html?category=${category.categorySlug}`);
            renderSubcategories(category); 
        });
        container.appendChild(categoryElement);
    });
    
    setView('kb-categories');
}


function renderSubcategories(category) {
    const listContainer = document.getElementById('article-list');
    const titleElement = document.getElementById('article-list-title');
    const linksContainer = document.getElementById('article-links-container');
    
    if (!titleElement || !linksContainer) {
        console.error("Critical Error: Missing #article-list-title or #article-links-container.");
        return;
    }

    titleElement.textContent = category.categoryTitle;
    linksContainer.innerHTML = ''; // Clear old content

    category.subcategories.forEach(sub => {
        const subTitle = document.createElement('h3');
        subTitle.textContent = sub.subcategoryTitle;
        linksContainer.appendChild(subTitle);
        
        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.padding = '0 0 20px 0';

        sub.articles.forEach(article => {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'article-link';
            link.href = `index.html?id=${article.id}`;
            link.textContent = article.title;
            
            link.addEventListener('click', (e) => {
                e.preventDefault();
                // Pass the full context for back button logic
                const articleContext = { ...article, category, subcategory: sub }; 
                history.pushState(null, '', link.href);
                renderArticleDetail(articleContext);
            });

            li.appendChild(link);
            ul.appendChild(li);
        });
        linksContainer.appendChild(ul);
    });
    
    setView('article-list'); 
}
function renderArticleDetail(article) {
    const detailTitle = document.getElementById('detail-title');
    const detailContent = document.getElementById('detail-content');
    const detailTags = document.getElementById('detail-tags');
    // 1. Add new element selector for the next step container
    const nextStepContainer = document.getElementById('next-step-container'); 
    const backButton = document.getElementById('back-to-previous');
    const copyBtn = document.getElementById('copy-markdown-btn');
    
    // 2. Include the new element in the check
    if (!detailTitle || !detailContent || !detailTags || !nextStepContainer || !backButton || !copyBtn) return; 

    detailTitle.textContent = article.title;
    detailContent.innerHTML = formatContent(article.content);

    detailTags.innerHTML = article.tags.map(tag => `<span>#${tag}</span>`).join('');

    // --- NEW LOGIC FOR NEXT STEP ---
    // --- NEW LOGIC FOR NEXT STEP ---
nextStepContainer.innerHTML = ''; // Clears the container initially
    
if (article.nextStep) { // <-- This is the check!
    // If article.nextStep is null, undefined, 0, or an empty string, 
    // the code inside this block is skipped.
    
    // Find the next article using the ID from the 'nextStep' field
    const allArticles = getAllArticles(knowledgeData);
    const nextArticle = allArticles.find(art => art.id === article.nextStep);

    if (nextArticle) { // <-- This check ensures a matching article exists.
         const nextLinkHtml = `
                <div id="read-next">
                    <p><strong>Next Step:</strong> We recommend you read this next:
                    <a href="index.html?id=${nextArticle.id}"
                       onclick="event.preventDefault(); renderNextArticle(${nextArticle.id});">
                       ${nextArticle.title}
                    </a>
                    </p>
                </div>
            `;
        nextStepContainer.innerHTML = nextLinkHtml;
    } else {
        console.warn(`Article ID ${article.id} has nextStep ID ${article.nextStep}, but no matching article was found.`);
    }
}
    // --- END NEW LOGIC ---

    // Attach the copy function to the button
    copyBtn.onclick = () => copyContentAsMarkdown(article.id);
    
    // Set the back button's behavior
    backButton.onclick = () => {
        // Go back to the subcategory list
        if (article.category && article.category.categorySlug) {
            history.pushState(null, '', `index.html?category=${article.category.categorySlug}`);
            renderSubcategories(article.category);
        } 
        // If coming from search
        else if (window.lastSearchQuery) {
            history.pushState(null, '', `index.html?search=${encodeURIComponent(window.lastSearchQuery)}`);
            runSearch(window.lastSearchQuery);
        }
        // Default fallback
        else {
            history.pushState(null, '', 'index.html');
            renderCategories(knowledgeData); 
        }
    };

    setView('article-detail');
}

// 3. Create a helper function to render the next article detail
function renderNextArticle(articleId) {
    const allArticles = getAllArticles(knowledgeData);
    const article = allArticles.find(art => art.id === articleId); 
    
    if (article) {
        const category = knowledgeData.find(cat => cat.categorySlug === article.categorySlug);
        const subcategory = category.subcategories.find(sub => sub.subcategorySlug === article.subcategorySlug);
        const articleContext = { ...article, category, subcategory };

        history.pushState(null, '', `index.html?id=${article.id}`);
        renderArticleDetail(articleContext);
    }
}

// --- SEARCH FUNCTIONS ---

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        window.lastSearchQuery = query; // Store last query for back button logic
        
        if (query.length === 0) {
            history.pushState(null, '', 'index.html');
            handleInitialUrl(knowledgeData); // Revert to initial view
            return;
        }

        history.pushState(null, '', `index.html?search=${encodeURIComponent(query)}`);
        runSearch(query);
    });
}

function runSearch(query) {
    const allArticles = getAllArticles(knowledgeData);
    const results = allArticles.filter(article => 
        article.title.toLowerCase().includes(query) || 
        article.content.toLowerCase().includes(query) ||
        article.tags.some(tag => tag.toLowerCase().includes(query))
    );
    renderSearchResults(results, query);
}

function renderSearchResults(results, query) {
    const titleElement = document.getElementById('search-results-title');
    const linksContainer = document.getElementById('search-links-container');
    
    if (!titleElement || !linksContainer) return;

    titleElement.textContent = `Search Results for "${query}" (${results.length} found)`;
    linksContainer.innerHTML = '';
    
    if (results.length === 0) {
        linksContainer.innerHTML = '<p>No articles found matching your search criteria.</p>';
    } else {
        results.forEach(article => {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'article-link';
            link.href = `index.html?id=${article.id}`;
            link.innerHTML = `<strong>${article.title}</strong> in <em>${article.subcategoryTitle} (${article.categoryTitle})</em>`;

            link.addEventListener('click', (e) => {
                e.preventDefault();
                // Find the full context for the back button
                const category = knowledgeData.find(cat => cat.categorySlug === article.categorySlug);
                const subcategory = category.subcategories.find(sub => sub.subcategorySlug === article.subcategorySlug);
                const articleContext = { ...article, category, subcategory };

                history.pushState(null, '', link.href);
                renderArticleDetail(articleContext);
            });
            
            li.appendChild(link);
            linksContainer.appendChild(li);
        });
    }
    setView('search-results');
}

// --- URL Parameter and Initial Load Logic ---

function handleInitialUrl(data) {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');
    const categorySlug = urlParams.get('category');
    const searchQuery = urlParams.get('search');
    const allArticles = getAllArticles(data);

    if (articleId) {
        const parsedId = parseInt(articleId); 
        
        const article = allArticles.find(art => art.id === parsedId); 
        
        if (article) {
            const category = data.find(cat => cat.categorySlug === article.categorySlug);
            const subcategory = category.subcategories.find(sub => sub.subcategorySlug === article.subcategorySlug);
            const articleContext = { ...article, category, subcategory };
            renderArticleDetail(articleContext);
        } else {
            renderCategories(data);
        }
    } else if (categorySlug) {
        const category = data.find(cat => cat.categorySlug === categorySlug);
        if (category) {
            renderSubcategories(category); 
        } else {
            renderCategories(data);
        }
    } else if (searchQuery) {
        document.getElementById('search-input').value = searchQuery;
        window.lastSearchQuery = searchQuery;
        runSearch(searchQuery);
    } else {
        renderCategories(data);
    }
}

// --- STATIC EVENT LISTENERS AND INITIALIZATION ---

function setupStaticListeners() {
    const backToCategoriesBtn = document.getElementById('back-to-categories');
    
    // Set listener once for Back To Categories button
    if (backToCategoriesBtn) {
        backToCategoriesBtn.addEventListener('click', () => {
            history.pushState(null, '', 'index.html');
            renderCategories(knowledgeData);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupStaticListeners();
    
    fetch('knowledgebase.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            knowledgeData = data; 
            setupSearch();
            handleInitialUrl(data); 
        })
        .catch(error => {
            console.error('Error loading knowledge base:', error);
            const view = document.getElementById('kb-main-view');
            if (view) {
                view.innerHTML = '<p style="color:red; text-align:center;">Error loading knowledge base content. Please check the `knowledgebase.json` file and console for details.</p>';
            }
        });
    
    // Handle browser back/forward buttons (using history API)
    window.addEventListener('popstate', () => {
        if (knowledgeData.length > 0) {
            handleInitialUrl(knowledgeData);
        }
    });
    
    console.log("To enable/disable the in-browser editor, open the Console and type: kb.toggleEditMode()");
});