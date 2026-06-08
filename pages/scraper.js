const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// 1. The extracted navigation hierarchy
const siteHierarchy = [
    {
        "title": "Home",
        "url": "https://acms-australia.org/"
    },
    {
        "title": "About Us",
        "url": "https://acms-australia.org/about-us",
        "subpages": [
            {
                "title": "Introduction",
                "url": "https://acms-australia.org/about-us/introduction",
                "subpages": [
                    { "title": "Nils Korner", "url": "https://acms-australia.org/about-us/introduction/nils-korner" },
                    { "title": "Rachel Valler", "url": "https://acms-australia.org/about-us/introduction/rachel-valler" }
                ]
            },
            { "title": "Member Benefits", "url": "https://acms-australia.org/about-us/about-member-benefits" },
            { "title": "What We Do", "url": "https://acms-australia.org/about-us/what-we-do" },
            { "title": "History", "url": "https://acms-australia.org/about-us/history" },
            { "title": "FAQ", "url": "https://acms-australia.org/about-us/faq" },
            { "title": "ACMS Committee Roles", "url": "https://acms-australia.org/about-us/acms-committee-roles" }
        ]
    },
    {
        "title": "Playing Days",
        "url": "https://acms-australia.org/playing-days",
        "subpages": [
            { "title": "Sydney Playing Days", "url": "https://acms-australia.org/playing-days/sydney-playing-days" },
            { "title": "Blue Mountains Playing Days", "url": "https://acms-australia.org/playing-days/blue-mountains" },
            { "title": "Brisbane Playing Days", "url": "https://acms-australia.org/playing-days/brisbane-playing-days" },
            { "title": "Canberra Playing Days", "url": "https://acms-australia.org/playing-days/canberra-playing-days" },
            { "title": "Advice for Pianists", "url": "https://acms-australia.org/playing-days/pianists-guide" },
            { "title": "Playing Day - Library", "url": "https://acms-australia.org/playing-days/playing-day-library" }
        ]
    },
    {
        "title": "Music Camp",
        "url": "https://acms-australia.org/music-camp",
        "subpages": [
            { "title": "Frensham Music Camp", "url": "https://acms-australia.org/music-camp/bathurst-music-camp" },
            { "title": "Wollongong 2011 Gallery", "url": "https://acms-australia.org/music-camp/wollongong-2011-gallery" },
            { "title": "Bathurst Camp 2022 Gallery", "url": "https://acms-australia.org/music-camp/bathurst-camp-2022-gallery" }
        ]
    },
    {
        "title": "Concerts",
        "url": "https://acms-australia.org/concerts",
        "subpages": [
            { "title": "For Organisers", "url": "https://acms-australia.org/concerts/for-organisers" },
            { "title": "Concert Archives", "url": "https://acms-australia.org/concerts/concert-archives" },
            { "title": "Kirribilli Concerts Photos", "url": "https://acms-australia.org/concerts/kirribilli-concerts-photos" },
            { "title": "Preparing for a Performance", "url": "https://acms-australia.org/concerts/preparing-performance" }
        ]
    },
    {
        "title": "Regions",
        "url": "https://acms-australia.org/regions",
        "subpages": [
            { "title": "Sydney", "url": "https://acms-australia.org/regions/sydney" },
            { "title": "Blue Mountains", "url": "https://acms-australia.org/regions/blue-mountain" },
            { "title": "Brisbane", "url": "https://acms-australia.org/regions/brisbane" },
            { "title": "Adelaide", "url": "https://acms-australia.org/regions/south-australia" },
            { "title": "Melbourne", "url": "https://acms-australia.org/regions/melbourne" },
            { "title": "Canberra", "url": "https://acms-australia.org/regions/canberra" }
        ]
    },
    {
        "title": "Join Us",
        "url": "https://acms-australia.org/join-us",
        "subpages": [
            { "title": "About Self-Grading", "url": "https://acms-australia.org/join-us/about-self-grading-1" },
            { "title": "Self Grading Description", "url": "https://acms-australia.org/join-us/self-grading-description" }
        ]
    },
    { "title": "Members Area", "url": "https://www.acms-australia.org/admidio" },
    { "title": "Contact ACMS", "url": "https://acms-australia.org/new-contact-page" },
    { "title": "Library", "url": "https://acms-australia.org/library" },
    { "title": "ACMS Online", "url": "https://acms-australia.org/extras" }
];

// Helper to delay requests (Politeness interval)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 2. Scrape individual page content (Updated to retain HTML structure)
async function scrapeContent(url) {
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);

        // Remove boilerplate elements that are not part of the main page content
        $('script, style, nav, header, footer, #header-nav, .top_nav_mega-menu, aside, form, iframe, noscript').remove();

        // Target the main content area
        let contentArea = $('main').length ? $('main') : 
                          $('.ccm-page').length ? $('.ccm-page') : 
                          $('body');

        // Optional but recommended: Strip layout attributes to keep the HTML structure clean
        contentArea.find('*').removeAttr('class').removeAttr('id').removeAttr('style').removeAttr('data-style');

        // Extract the raw HTML structure instead of flattening it to text
        let htmlContent = contentArea.html();
        
        // Clean up any massive chunks of whitespace generated by removing the elements above
        if (htmlContent) {
            htmlContent = htmlContent.replace(/\n\s*\n/g, '\n').trim();
        }
        
        return htmlContent;
    } catch (error) {
        console.error(`  [X] Failed to scrape ${url}: ${error.message}`);
        return null;
    }
}

// 3. Recursively traverse the hierarchy and attach scraped content
async function processHierarchy(nodes) {
    for (let node of nodes) {
        console.log(`Scraping: ${node.title} -> ${node.url}`);
        
        // Skip external or non-content links like the Members Area (Admidio system)
        if (!node.url.includes('admidio')) {
            const content = await scrapeContent(node.url);
            if (content) {
                node.content = content;
            }
            // Wait 1 second between requests to avoid overloading the server
            await sleep(1000); 
        } else {
            node.content = "[Skipped: External/Application Link]";
            console.log(`  [-] Skipped external portal.`);
        }

        // If the node has subpages, process them recursively
        if (node.subpages && node.subpages.length > 0) {
            await processHierarchy(node.subpages);
        }
    }
}

// 4. Run the Scraper
async function run() {
    console.log("Starting ACMS Australia Scraper...\n");
    
    // Deep clone the hierarchy so we can mutate it with content
    const fullSiteData = JSON.parse(JSON.stringify(siteHierarchy));
    
    await processHierarchy(fullSiteData);
    
    const outputFile = 'acms_full_content.json';
    fs.writeFileSync(outputFile, JSON.stringify(fullSiteData, null, 4), 'utf-8');
    
    console.log(`\n✅ Scraping complete! Data saved to ${outputFile}`);
}

run();
