let watchlist = [];
let currentAnalysisData = null;
 
// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchSectors();
   
    // Event Listeners
    document.getElementById('addBtn').addEventListener('click', addTicker);
    document.getElementById('clearBtn').addEventListener('click', () => { watchlist = []; updateWatchlistUI(); });
    document.getElementById('analyzeBtn').addEventListener('click', analyzeStocks);
    document.getElementById('askAiBtn').addEventListener('click', askAI);
    document.getElementById('sectorSelect').addEventListener('change', function() {
        const selector = document.getElementById('sectorSelect');
   
        // IF USER SELECTS "Custom Selection" -CLEAR LIST
        if (selector.value === 'Custom') {
            watchlist = []; // Clear the array
            updateWatchlistUI(); // Update the screen
        }
        // IF USER SELECTS A REAL SECTOR (like Technology) -> REPLACE LIST
        else {
            // Optional: If we want selecting a sector to REPLACE everything else instead of adding to it:
            // watchlist = [];
       
            loadSector(); // This loads the new sector stocks
        }
    });
});
 
// Fetch Sectors for Dropdown
async function fetchSectors() {
    const res = await fetch('/api/sectors');
    const sectors = await res.json();
    const select = document.getElementById('sectorSelect');
   
    for (const [name, tickers] of Object.entries(sectors)) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    }
}
 
function loadSector() {
    const sector = document.getElementById('sectorSelect').value;
    if (sector === 'Custom') return;
   
    // We need to fetch the ticker list again to get the array
    fetch('/api/sectors').then(res => res.json()).then(data => {
        watchlist = [...new Set([...watchlist, ...data[sector]])]; // Add unique
        updateWatchlistUI();
    });
}
 
//Watchlist Management
 
 
function addTicker() {
    const input = document.getElementById('tickerInput');
    const rawValue = input.value;
   
    if (!rawValue) return;
 
    // SPLIT BY COMMA
    // This turns "apple, microsoft" into ["apple", " microsoft"]
    const tokens = rawValue.split(',');
 
    tokens.forEach(token => {
        const val = token.trim().toUpperCase(); // Remove spaces
       
        // Only add if not empty and not already in list
        if (val && !watchlist.includes(val)) {
            watchlist.push(val);
        }
    });
 
    updateWatchlistUI();
    input.value = ''; // Clear input box
}
 
function updateWatchlistUI() {
    const ul = document.getElementById('watchlist');
    ul.innerHTML = '';
    watchlist.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `${t} <span class="remove-btn" onclick="removeTicker('${t}')">✖</span>`;
        ul.appendChild(li);
    });
}
 
window.removeTicker = (t) => {
    watchlist = watchlist.filter(item => item !== t);
    updateWatchlistUI();
}
 
// Main Analysis
 
async function analyzeStocks() {
    if (watchlist.length === 0) return alert("Add stocks to watchlist first!");
   
    //Get the values directly from the user's input
    const startVal = document.getElementById('startDate').value;
    const endVal = document.getElementById('endDate').value;
 
    //Basic validation to ensure user actually picked dates
    if (!startVal || !endVal) {
        return alert("Please select both a Start Date and an End Date.");
    }
 
    const btn = document.getElementById('analyzeBtn');
    const status = document.getElementById('statusMsg');
   
    btn.textContent = "Processing...";
    status.textContent = "Fetching data...";
   
    try {
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                tickers: watchlist,
                //SEND THE EXACT DATES THE USER SELECTED
                start_date: startVal,
                end_date: endVal
            })
        });
       
        const data = await res.json();
        currentAnalysisData = data;
       
       
        renderTable(data.metrics);
        renderCharts(data.charts);
        renderHeatmap(data.correlation);
        renderNews(data.news);
       
        status.textContent = `Analysis complete for ${data.metrics.length} stocks.`;
    } catch (e) {
        console.error(e);
        status.textContent = "Error during analysis.";
    } finally {
        btn.textContent = "ANALYZE STOCKS";
    }
}
 
//Render Functions
function renderTable(metrics) {
    const tbody = document.querySelector('#metricsTable tbody');
    tbody.innerHTML = '';
   
    metrics.forEach(m => {
        const tr = `
            <tr>
                <td style="font-weight:bold; color:var(--accent-color)">${m.ticker}</td>
                <td>${m.total_return}</td>
                <td>${m.ann_volatility}</td>
                <td>${m.sharpe}</td>
                <td style="color:#ff6b6b">${m.max_drawdown}</td>
                <td>${m.start_price}</td>
                <td>${m.end_price}</td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });
}
 
 
 
function renderCharts(data) {
    const priceChart = document.getElementById('priceChart');
    const volumeChart = document.getElementById('volumeChart');
   
    //CHECK THEME
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
   
    //DEFINE COLORS
    const bgColor = isLight ? '#ffffff' : 'rgba(0,0,0,0)';
    const textColor = isLight ? '#1a202c' : '#94a3b8';
    const gridColor = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)';
 
    // Price Chart Data
    const priceData = [];
    Object.keys(data).forEach(ticker => {
        const d = data[ticker];
        priceData.push({
            x: d.dates,
            y: d.close,
            type: 'scatter',
            mode: 'lines',
            name: ticker,
            line: { width: 3 }
        });
    });
 
    //Layout Config
    const commonLayout = {
        autosize: true,
        plot_bgcolor: bgColor,
        paper_bgcolor: bgColor,
        font: { color: textColor, family: "Inter, sans-serif" },
       
        //MARGINS
        margin: { t: 30, r: 50, l: 40, b: 40 },
 
        xaxis: {
            gridcolor: gridColor,
            showspikes: true,
            spikethickness: 1,
            spikedash: "dot",
            spikecolor: isLight ? "#cbd5e1" : "#999"
        },
        yaxis: {
            gridcolor: gridColor,
            zerolinecolor: gridColor
        },
        hovermode: "x unified",
 
        //LEGEND FIX
        showlegend: true,
        legend: {
            x: 1.05,            
            xanchor: 'left',    //Anchor the left side of legend to that point
            y: 1,               //Align to top
            yanchor: 'top',
            bgcolor: 'rgba(0,0,0,0)'
        }
    };
 
    // --- CHANGED: displayModeBar is now true ---
    const config = { responsive: true, displayModeBar: true };
 
    Plotly.newPlot('priceChart', priceData, commonLayout, config);
 
    //Volume Chart Data
    const volData = [];
    Object.keys(data).forEach(ticker => {
        const d = data[ticker];
        volData.push({
            x: d.dates,
            y: d.volume,
            type: 'bar',
            name: ticker,
            marker: { opacity: 0.7 }
        });
    });
 
    Plotly.newPlot('volumeChart', volData, commonLayout, config);
}
 
 
 
function renderHeatmap(data) {
    const chartDiv = document.getElementById('heatmapChart');
 
    // Check Theme
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
   
    // Define Colors
    // Dark Mode = Transparent | Light Mode = White
    const bgColor = isLight ? '#ffffff' : 'rgba(0,0,0,0)';
    const textColor = isLight ? '#1a202c' : '#ffffff';
 
    // Handle No Data
    if (!data || data.length === 0) {
        chartDiv.innerHTML = '<div style="padding:20px; text-align:center; color:'+textColor+'">Not enough data for correlation.</div>';
        return;
    }
   
    // Clear previous content
    chartDiv.innerHTML = '';
 
    const plotData = [{
        z: data.z,
        x: data.x,
        y: data.y,
        type: 'heatmap',
       
        // CLASSIC RED-BLUE SCHEME
        colorscale: 'RdBu',
       
        // RED = High Correlation (1.0) and BLUE = Low
        reversescale: true,
       
        showscale: true
    }];
 
    const layout = {
        autosize: true,
        title: '',
        paper_bgcolor: bgColor,
        plot_bgcolor: bgColor,
        font: { color: textColor, family: "Inter, sans-serif" },
        // Tight margins so it fills the card
        margin: { t: 30, r: 30, l: 60, b: 60 },
        xaxis: { tickangle: -45 },
        yaxis: { automargin: true }
    };
 
    // --- CHANGED: displayModeBar is now true ---
    const config = {
        responsive: true,
        displayModeBar: true
    };
 
    Plotly.newPlot('heatmapChart', plotData, layout, config);
}
 
//AI Feature
async function askAI() {
    const promptInput = document.getElementById('aiPrompt');
    const prompt = promptInput.value.trim();
   
    if (!prompt) return alert("Please enter a question.");
    if (!currentAnalysisData) return alert("Please run 'Analyze Stocks' first.");
 
    const output = document.getElementById('aiResponse');
    const btn = document.getElementById('askAiBtn');
   
    // UI Loading
    output.textContent = "Analyzing charts and data...";
    btn.disabled = true;
 
    // BUILD CONTEXT FOR AI
    // Add the Metrics (Table Data)
    let contextStr = "--- FINANCIAL METRICS ---\n";
    currentAnalysisData.metrics.forEach(m => {
        contextStr += `Ticker: ${m.ticker} | Return: ${m.total_return} | Volatility: ${m.ann_volatility} | Sharpe: ${m.sharpe} | Max Drawdown: ${m.max_drawdown}\n`;
    });
 
    // Add Correlation Data (Heatmap)
    if (currentAnalysisData.correlation && currentAnalysisData.correlation.z) {
        contextStr += "\n--- CORRELATION MATRIX (Heatmap) ---\n";
        const tickers = currentAnalysisData.correlation.x;
        const values = currentAnalysisData.correlation.z;
       
        //Format as: "AAPL vs MSFT: 0.85"
        for (let i = 0; i < tickers.length; i++) {
            for (let j = i + 1; j < tickers.length; j++) {
                contextStr += `${tickers[i]} vs ${tickers[j]}: ${values[i][j].toFixed(2)}\n`;
            }
        }
    }
 
    // Add Price Trend Summary (Charts)
    //Send a simplified version (Start, Middle, End) + Trend description
    contextStr += "\n--- PRICE & VOLUME TRENDS ---\n";
    Object.keys(currentAnalysisData.charts).forEach(ticker => {
        const data = currentAnalysisData.charts[ticker];
        const len = data.close.length;
        if (len > 0) {
            const startP = data.close[0].toFixed(2);
            const endP = data.close[len-1].toFixed(2);
            const midP = data.close[Math.floor(len/2)].toFixed(2);
           
            //Calculate Average Volume
            const avgVol = data.volume.reduce((a, b) => a + b, 0) / len;
           
            contextStr += `Ticker: ${ticker}\n`;
            contextStr += ` - Price Path: Starts at $${startP} -> Mid: $${midP} -> Ends at $${endP}\n`;
            contextStr += ` - Avg Daily Volume: ${(avgVol/1000000).toFixed(1)}M shares\n`;
           
            //Send the last 5 days of data specifically for recent context
            contextStr += ` - Last 5 Days Prices: ${data.close.slice(-5).map(p => p.toFixed(2)).join(', ')}\n`;
        }
    });
 
    try {
        const res = await fetch('/api/ai_help', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                prompt: prompt,
                context: contextStr //detailed chart data
            })
        });
       
        const data = await res.json();
        output.textContent = data.answer;
       
    } catch (e) {
        output.textContent = "Error connecting to AI.";
        console.error(e);
    } finally {
        btn.disabled = false;
        promptInput.value = '';
    }
}
 
 
function renderNews(newsItems) {
    const container = document.getElementById('newsContainer');
    container.innerHTML = '';
 
    if (!newsItems || newsItems.length === 0) {
        container.innerHTML = '<div style="padding:10px">No recent news found.</div>';
        return;
    }
 
    newsItems.forEach(item => {
        //Create a card for each article
        const card = document.createElement('div');
        card.className = 'news-card';
       
        // Use a generic placeholder if no image exists
        const imgUrl = item.thumbnail || 'https://via.placeholder.com/80?text=News';
 
        card.innerHTML = `
            <div class="news-img" style="background-image: url('${imgUrl}')"></div>
            <div class="news-content">
                <div class="news-meta">
                    <span class="news-ticker">${item.ticker}</span>
                    <span class="news-publisher">${item.publisher}</span>
                </div>
                <a href="${item.link}" target="_blank" class="news-title">${item.title}</a>
            </div>
        `;
        container.appendChild(card);
    });
}
 
//THEME TOGGLE
document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('themeToggle');
    if (!themeBtn) return;
 
    const icon = themeBtn.querySelector('i');
 
    // Load saved theme from previous visit
    if (localStorage.getItem('theme') === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        icon.className = 'fa-solid fa-moon'; // moon icon
    } else {
        icon.className = 'fa-solid fa-sun'; // sun icon
    }
 
    // Handle Click
    themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
       
        // Switch Theme
        if (currentTheme === 'light') {
            // Switch to Dark
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'dark');
            icon.className = 'fa-solid fa-sun';
        } else {
            // Switch to Light
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            icon.className = 'fa-solid fa-moon';
        }
 
        // Redraw Charts Immediately
        // This checks if we have any data loaded; if so, it re-runs the render functions
        if (typeof currentAnalysisData !== 'undefined' && currentAnalysisData) {
            renderCharts(currentAnalysisData.charts);
           
            // Check if heatmap data exists and redraw it too
            if (currentAnalysisData.correlation && typeof renderHeatmap === 'function') {
                renderHeatmap(currentAnalysisData.correlation);
            }
        }
    });
});
 