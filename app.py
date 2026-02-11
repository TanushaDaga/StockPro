from flask import Flask, render_template, request, jsonify
import yfinance as yf
import pandas as pd
import numpy as np
from openai import OpenAI
import datetime
from stock_data import COMPANY_TO_TICKER, SECTORS

app = Flask(__name__)


from dotenv import load_dotenv
import os

load_dotenv()   # loads variables from .env

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def smart_lookup(query):
    query = query.strip().lower()
    if query in COMPANY_TO_TICKER:
        return COMPANY_TO_TICKER[query]
    return query.upper()

def calculate_metrics(ticker, df):
    if df.empty: return None
    
    start_price = df['Close'].iloc[0]
    end_price = df['Close'].iloc[-1]
    
    #Calculate returns
    df['Daily_Return'] = df['Close'].pct_change()
    total_return = (end_price - start_price) / start_price
    
    #Annualized calculations
    days = (df.index[-1] - df.index[0]).days
    ann_return = ((1 + total_return) ** (365 / max(days, 1))) - 1
    ann_volatility = df['Daily_Return'].std() * np.sqrt(252)
    
    #Max Drawdown
    rolling_max = df['Close'].cummax()
    drawdown = df['Close'] / rolling_max - 1
    max_drawdown = drawdown.min()
    
    #Sharpe (Risk free = 0)
    sharpe = (ann_return / ann_volatility) if ann_volatility != 0 else 0

    return {
        "ticker": ticker,
        "total_return": f"{total_return:.2%}",
        "ann_return": f"{ann_return:.2%}",
        "ann_volatility": f"{ann_volatility:.2%}",
        "sharpe": f"{sharpe:.2f}",
        "max_drawdown": f"{max_drawdown:.2%}",
        "start_price": f"${start_price:.2f}",
        "end_price": f"${end_price:.2f}",
        "days": days
    }

#Routes

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/sectors')
def get_sectors():
    return jsonify(SECTORS)


@app.route('/api/analyze', methods=['POST'])
def analyze_stocks():
    data = request.json
    tickers = [smart_lookup(t) for t in data.get('tickers', [])]
    
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    
    results = []
    history_data = {} 
    news_data = [] 
    
    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(start=start_date, end=end_date)
            
            if not df.empty:
                metrics = calculate_metrics(ticker, df)
                if metrics:
                    results.append(metrics)
                    
                    history_data[ticker] = {
                        "dates": df.index.strftime('%Y-%m-%d').tolist(),
                        "close": df['Close'].tolist(),
                        "volume": df['Volume'].tolist()
                    }

                    # NEWS FETCHING
                    try:
                        stock_news = stock.news
                        if stock_news:
                            for item in stock_news[:3]:
                                #Define the Data Source (Top level vs Nested 'content')
                                # Some items have data at the top, others wrap it in 'content'
                                data_source = item
                                if 'content' in item and isinstance(item['content'], dict):
                                    data_source = item['content']

                                #Extract Fields safely from the identified source
                                # TITLE
                                title = data_source.get('title', 'No Headline')
                                
                                # PUBLISHER
                                # Sometimes it's 'publisher', sometimes 'provider' -> 'displayName'
                                publisher = 'Unknown Source'
                                if 'publisher' in data_source:
                                    publisher = data_source['publisher']
                                elif 'provider' in data_source:
                                    publisher = data_source['provider'].get('displayName', 'Unknown Source')

                                # LINK
                                # Check 'link','canonicalUrl', or 'clickThroughUrl'
                                link = '#'
                                if 'link' in data_source:
                                    link = data_source['link']
                                elif 'canonicalUrl' in data_source:
                                    link = data_source['canonicalUrl'].get('url', '#')
                                elif 'clickThroughUrl' in data_source:
                                    link = data_source['clickThroughUrl'].get('url', '#')

                                #THUMBNAIL
                                thumb_url = "https://via.placeholder.com/80?text=News"
                                try:
                                    if 'thumbnail' in data_source:
                                        resolutions = data_source['thumbnail'].get('resolutions', [])
                                        if resolutions:
                                            thumb_url = resolutions[0].get('url', thumb_url)
                                except:
                                    pass

                                news_data.append({
                                    "ticker": ticker,
                                    "title": title,
                                    "publisher": publisher,
                                    "link": link,
                                    "thumbnail": thumb_url
                                })
                    except Exception as e:
                        print(f"News error for {ticker}: {e}")

        except Exception as e:
            print(f"Error {ticker}: {e}")

    #CORRELATION
    correlation_matrix = []
    if len(tickers) > 1 and len(results) > 1:
        price_df = pd.DataFrame()
        for t in tickers:
            if t in history_data:
                price_df[t] = pd.Series(history_data[t]['close'])
        
        if not price_df.empty:
            corr = price_df.pct_change().corr().fillna(0)
            correlation_matrix = {
                "z": corr.values.tolist(),
                "x": corr.columns.tolist(),
                "y": corr.columns.tolist()
            }

    return jsonify({
        "metrics": results,
        "charts": history_data,
        "correlation": correlation_matrix,
        "news": news_data 
    })


@app.route('/api/ai_help', methods=['POST'])
def ai_help():
    data = request.json
    prompt = data.get('prompt')
    context = data.get('context')

    #Check if key exists
    if not GROQ_API_KEY:
        return jsonify({"answer": "Server Error: Groq API Key is missing."})

    try:
        #CONNECT TO GROQ (Base URL is distinct)
        client = OpenAI(
            api_key=GROQ_API_KEY, 
            base_url="https://api.groq.com/openai/v1"
        )
        
        #USE A GROQ MODEL
        response = client.chat.completions.create(
            #Llama 3 very fast 
            model="llama-3.3-70b-versatile", 
            messages=[
                {"role": "system", "content": "You are a helpful financial analyst. Keep answers short, professional and data-driven."},
                {"role": "user", "content": f"Here is the stock data:\n{context}\n\nUser Question: {prompt}"}
            ]
        )
        return jsonify({"answer": response.choices[0].message.content})

    except Exception as e:
        print(f"Groq Error: {e}")
        return jsonify({"answer": f"Error: {str(e)}"})
    
if __name__ == '__main__':
    print("Starting Flask server...")  
    app.run(debug=True)