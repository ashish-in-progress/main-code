import nodemailer from "nodemailer";
import MarkdownIt from "markdown-it";
import axios from "axios";
import { logger } from "../../utils/logger.js";
function extractTicker(raw) {
  if (!raw) return null;

  // Remove exchange prefix like "NSE:" or "BSE:"
  let s = raw.trim().replace(/^[A-Za-z]+:/, "");

  // Remove -EQ or .EQ
  s = s.replace(/[-.]EQ$/i, "");

  return s.toUpperCase(); // return IDEA
}

// Example:
// console.log(extractTicker("NSE:IDEA-EQ")); // IDEA

export class EmailService {
  static transporter = null;

  // Markdown engine
  static md = new MarkdownIt({
    html: false,
    breaks: true,
    linkify: true,
  });

  /**
   * Fetch current price from external API
   */
  static async getCurrentPrice(symbol) {
    try {
      logger.info(`Fetching current price for ${symbol} from API`);
      
      const ticker = extractTicker(symbol);  // IDEA
      const response = await axios.get(`https://33trpk9t-5500.inc1.devtunnels.ms/current?symbol=${ticker}.NS`);
      
      if (response.data && response.data.current_price) {
        return response.data.current_price;
      }
      
      logger.warn(`No current price returned for ${symbol}`);
      return null;
    } catch (error) {
      logger.error(`Error fetching current price for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Convert Markdown → Email-Safe HTML
   */
  static renderEmailMarkdown(mdText = "") {
    if (!mdText) return "";

    let html = this.md.render(mdText || "");

    // Convert <ul><li> → email-safe bullets
    html = html.replace(/<ul>/g, '<div style="margin:8px 0;">');
    html = html.replace(/<\/ul>/g, "</div>");
    html = html.replace(
      /<li>/g,
      '<div style="font-size:14px;line-height:1.6;padding:4px 0;margin-left:15px;">• '
    );
    html = html.replace(/<\/li>/g, "</div>");

    // Headings → styled divs
    html = html.replace(
      /<h1>(.*?)<\/h1>/g,
      '<div style="font-size:20px;font-weight:bold;margin:15px 0 10px;color:#2c3e50;">$1</div>'
    );
    html = html.replace(
      /<h2>(.*?)<\/h2>/g,
      '<div style="font-size:18px;font-weight:bold;margin:12px 0 8px;color:#2c3e50;">$1</div>'
    );
    html = html.replace(
      /<h3>(.*?)<\/h3>/g,
      '<div style="font-size:16px;font-weight:bold;margin:10px 0 6px;color:#2c3e50;">$1</div>'
    );

    // Paragraphs
    html = html.replace(
      /<p>/g,
      '<p style="font-size:14px;line-height:1.6;margin:8px 0;color:#555;">'
    );

    // Links
    html = html.replace(
      /<a href=/g,
      '<a style="color:#3498db;text-decoration:none;" href='
    );

    return html;
  }

  /**
   * Safe number converter
   */
  static safeNumber(value) {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Initialize email transporter
   */
  static initialize() {
    if (this.transporter) return;

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    logger.info("Email service initialized");
  }

  /**
   * Send stock insights email with real-time prices
   */
  static async sendInsightsEmail(userEmail, insights) {
    if (!this.transporter) {
      this.initialize();
    }

    // Update current prices for all holdings before generating email
    const updatedHoldings = await Promise.all(
      insights.holdings.map(async (holding) => {
        const currentPrice = await this.getCurrentPrice(holding.symbol);
        
        if (currentPrice) {
          // Recalculate PnL with updated price
          const avgPrice = this.safeNumber(holding.average_price);
          const quantity = this.safeNumber(holding.quantity);
          const updatedPnl = (currentPrice - avgPrice) * quantity;
          const updatedPnlPercentage = ((currentPrice - avgPrice) / avgPrice) * 100;

          return {
            ...holding,
            current_price: currentPrice,
            pnl: updatedPnl,
            pnl_percentage: updatedPnlPercentage
          };
        }
        
        return holding;
      })
    );

    // Update insights with refreshed holdings
    const updatedInsights = {
      ...insights,
      holdings: updatedHoldings
    };

    const htmlContent = this.generateInsightsHTML(updatedInsights);

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject: `📊 Your Daily Stock Insights - ${new Date().toLocaleDateString('en-IN')}`,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${userEmail}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send email to ${userEmail}:`, error.message);
      throw error;
    }
  }
// ✅ ADD sendEmail() BEFORE sendOTP()
static async sendEmail(options) {
  if (!this.transporter) {
    this.initialize();
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    ...options
  };

  try {
    const info = await this.transporter.sendMail(mailOptions);
    logger.info(`✅ Email sent to ${options.to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`❌ Failed to send email to ${options.to}:`, error.message);
    throw error;
  }
}

static async sendOTP(email, otp) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">🔐 TradeAI Login Verification</h2>
      <div style="background: #f8f9fa; padding: 30px; border-radius: 12px; text-align: center; margin: 20px 0;">
        <h1 style="font-size: 48px; color: #2563eb; letter-spacing: 12px; margin: 0; font-weight: bold;">${otp}</h1>
        <p style="color: #6b7280; font-size: 16px; margin: 20px 0;">Your verification code expires in <strong>5 minutes</strong></p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        Enter this code in the app to complete login. If you didn't request this, ignore this email.
      </p>
    </div>
  `;
  
  return await this.sendEmail({
    to: email,
    subject: `TradeAI Login - Your OTP Code: ${otp}`,
    html: htmlContent
  });
}

  /**
   * Generate Fixed Email Template
   */
  static generateInsightsHTML(insights) {
    const { date, holdings, overallSummary, analysis } = insights;

    // Calculate portfolio metrics
    const totalHoldings = holdings.length;
    const totalPnL = this.safeNumber(analysis?.totalPnL || 0);
    const avgPnLPercent = this.safeNumber(analysis?.avgPnLPercent || 0);
    const gainers = analysis?.gainers || 0;
    const losers = analysis?.losers || 0;

    // Portfolio status message
    let portfolioStatus = "";
    if (totalHoldings === 1) {
      portfolioStatus = `Your portfolio has only one stock (${holdings[0].symbol}). Any small change in ${holdings[0].symbol} affects your entire portfolio.`;
    } else if (avgPnLPercent > 0) {
      portfolioStatus = `Your portfolio is performing well with an average gain of ${avgPnLPercent.toFixed(2)}%. ${gainers} ${gainers === 1 ? 'stock is' : 'stocks are'} in profit and ${losers} ${losers === 1 ? 'is' : 'are'} in loss.`;
    } else {
      portfolioStatus = `Your portfolio is showing an average loss of ${Math.abs(avgPnLPercent).toFixed(2)}%. ${losers} ${losers === 1 ? 'stock is' : 'stocks are'} in loss and ${gainers} ${gainers === 1 ? 'is' : 'are'} in profit.`;
    }

    // Generate individual stock sections - FIXED VERSION
    const stockSectionsHTML = holdings
      .map((holding) => {
        const avgPrice = this.safeNumber(holding.average_price);
        const currentPrice = this.safeNumber(holding.current_price);
        const pnl = this.safeNumber(holding.pnl);
        const pnlPercentage = this.safeNumber(holding.pnl_percentage);
        const quantity = this.safeNumber(holding.quantity);
        const rsi = holding.technical?.rsi;
        const sma20 = holding.technical?.sma20;
        const sma50 = holding.technical?.sma50;
        const signal = holding.technical?.signal || 'HOLD';
        const strength = holding.technical?.strength || 'NEUTRAL';
        const macd = holding.technical?.macd;
        const additionalInfo = holding.technical?.additionalInfo || [];

        // Performance message
        let performanceMsg = "";
        if (Math.abs(pnlPercentage) < 1) {
          performanceMsg = `${holding.symbol} is ${pnlPercentage >= 0 ? 'slightly up' : 'slightly down'} by ${Math.abs(pnlPercentage).toFixed(2)}%, a very small movement.`;
        } else if (pnlPercentage > 0) {
          performanceMsg = `${holding.symbol} is performing well, up by ${pnlPercentage.toFixed(2)}%. This is positive.`;
        } else {
          performanceMsg = `${holding.symbol} is down by ${Math.abs(pnlPercentage).toFixed(2)}%. ${Math.abs(pnlPercentage) > 5 ? 'This needs attention.' : 'This is a normal market movement.'}`;
        }

        // Technical explanation
        let technicalMsg = "";
        
        if (rsi) {
          if (rsi > 70) {
            technicalMsg = `RSI is ${rsi.toFixed(0)} (overbought) - price has risen significantly and may correct soon.`;
          } else if (rsi < 30) {
            technicalMsg = `RSI is ${rsi.toFixed(0)} (oversold) - price has fallen significantly and may bounce back.`;
          } else if (rsi >= 60) {
            technicalMsg = `RSI is ${rsi.toFixed(0)} - price rising but not at extreme levels.`;
          } else if (rsi <= 40) {
            technicalMsg = `RSI is ${rsi.toFixed(0)} - price falling but may stabilize.`;
          } else {
            technicalMsg = `RSI is ${rsi.toFixed(0)} (neutral zone) - no extreme movements expected.`;
          }

          // Add moving average context
          if (sma20 && sma50) {
            if (currentPrice > sma20 && sma20 > sma50) {
              technicalMsg += ` Price is above 20-day (₹${sma20.toFixed(2)}) and 50-day (₹${sma50.toFixed(2)}) averages (bullish).`;
            } else if (currentPrice < sma20 && sma20 < sma50) {
              technicalMsg += ` Price is below 20-day (₹${sma20.toFixed(2)}) and 50-day (₹${sma50.toFixed(2)}) averages (bearish).`;
            }
          }
        }

        // Technical indicators - SIMPLIFIED
        let technicalDetails = "";
        if (rsi || sma20 || macd) {
          technicalDetails = `
            <div style="margin-top:10px;font-size:13px;color:#555;">
              ${rsi ? `<div style="padding:3px 0;"><strong>RSI:</strong> ${rsi.toFixed(2)} <span style="padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600;background:${
                rsi > 70 ? '#fee2e2;color:#991b1b' : 
                rsi < 30 ? '#d1fae5;color:#065f46' : 
                '#f3f4f6;color:#374151'
              };">${rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL'}</span></div>` : ''}
              ${sma20 ? `<div style="padding:3px 0;"><strong>SMA 20:</strong> ₹${sma20.toFixed(2)}</div>` : ''}
              ${sma50 ? `<div style="padding:3px 0;"><strong>SMA 50:</strong> ₹${sma50.toFixed(2)}</div>` : ''}
              ${macd ? `<div style="padding:3px 0;"><strong>MACD:</strong> ${macd.toFixed(2)}</div>` : ''}
              <div style="padding:8px 0;">
                <span style="display:inline-block;padding:6px 12px;border-radius:6px;font-weight:bold;font-size:13px;background:${
                  signal === 'BUY' ? '#d1fae5;color:#065f46' : 
                  signal === 'SELL' ? '#fee2e2;color:#991b1b' : 
                  '#f3f4f6;color:#374151'
                };">${signal}</span>
                <span style="margin-left:8px;padding:4px 8px;background:#f8f9fa;border-radius:4px;font-size:11px;color:#6b7280;">${strength}</span>
              </div>
            </div>
          `;
        }

        // Additional insights
        let additionalInsightsHTML = "";
        if (additionalInfo && additionalInfo.length > 0) {
          additionalInsightsHTML = `
            <div style="margin-top:10px;padding:10px;background:#f8fafc;border-radius:6px;border-left:3px solid #3b82f6;">
              <div style="font-size:13px;font-weight:bold;color:#1e40af;margin-bottom:6px;">📌 Key Points:</div>
              ${additionalInfo.slice(0, 3).map(info => `
                <div style="font-size:12px;color:#475569;padding:3px 0;">• ${info}</div>
              `).join('')}
            </div>
          `;
        }

        // News section
        let newsHTML = "";
        if (holding.news && holding.news.length > 0) {
          const topNews = holding.news.slice(0, 3);
          newsHTML = topNews
            .map(n => `<div style="padding:6px 0;font-size:14px;line-height:1.5;">• <a href="${n.url}" style="color:#3498db;text-decoration:none;">${n.title}</a></div>`)
            .join("");
        } else {
          newsHTML = `<div style="padding:6px 0;font-size:14px;color:#777;">No recent news available</div>`;
        }

        return `
          <div style="margin-bottom:20px;padding:20px;background:#ffffff;border-radius:12px;border:1px solid #e0e0e0;">
            
            <!-- Stock Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <div style="font-size:22px;font-weight:bold;color:#2c3e50;">
                ${holding.symbol}
                <span style="font-size:12px;padding:4px 8px;background:#f1f5f9;color:#64748b;border-radius:4px;margin-left:8px;font-weight:600;">${holding.broker.toUpperCase()}</span>
                ${holding.holding_type === 'POSITION' ? `<span style="font-size:12px;padding:4px 8px;background:#fed7aa;color:#c2410c;border-radius:4px;margin-left:4px;font-weight:600;">⚡ POSITION</span>` : ''}
              </div>
              <div style="font-size:18px;font-weight:bold;color:${pnl >= 0 ? "#27ae60" : "#e74c3c"};">
                ${pnl >= 0 ? "📈" : "📉"} ${pnlPercentage >= 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%
              </div>
            </div>

            <div style="margin-top:12px;padding:12px;background:#f8f9fa;border-radius:8px;border-left:4px solid ${pnl >= 0 ? "#27ae60" : "#e74c3c"};">
              <div style="font-size:15px;color:#555;line-height:1.6;">${performanceMsg}</div>
            </div>

            <!-- Basic Details -->
            <div style="margin-top:15px;">
              <div style="font-size:16px;font-weight:bold;color:#34495e;margin-bottom:8px;">📊 Your Position</div>
              <div style="font-size:14px;color:#555;line-height:1.8;">
                <div>• You own <strong>${quantity} shares</strong> at avg price ₹${avgPrice.toFixed(2)}</div>
                <div>• Current price: <strong>₹${currentPrice.toFixed(2)}</strong></div>
                <div>• Your ${pnl >= 0 ? 'profit' : 'loss'}: <strong style="color:${pnl >= 0 ? "#27ae60" : "#e74c3c"};">₹${Math.abs(pnl).toFixed(2)}</strong></div>
              </div>
            </div>

            <!-- Technical Section -->
            ${technicalMsg || rsi ? `
            <div style="margin-top:15px;padding:12px;background:#e8f4f8;border-radius:8px;">
              <div style="font-size:16px;font-weight:bold;color:#34495e;margin-bottom:8px;">📈 Technical Analysis</div>
              ${technicalMsg ? `<div style="font-size:14px;color:#555;line-height:1.6;margin-bottom:8px;">${technicalMsg}</div>` : ''}
              ${technicalDetails}
              ${additionalInsightsHTML}
            </div>
            ` : ''}

            <!-- News Section -->
            <div style="margin-top:15px;">
              <div style="font-size:16px;font-weight:bold;color:#34495e;margin-bottom:8px;">📰 Latest News</div>
              ${newsHTML}
            </div>

            <!-- AI Insights -->
            <div style="margin-top:15px;padding:12px;background:#f0f9ff;border-radius:8px;border-left:4px solid #3498db;">
              <div style="font-size:16px;font-weight:bold;color:#34495e;margin-bottom:8px;">🤖 AI Analysis</div>
              <div style="font-size:14px;color:#555;line-height:1.7;">
                ${this.renderEmailMarkdown(holding.aiInsight)}
              </div>
            </div>

          </div>
        `;
      })
      .join("");

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

      <div style="max-width:650px;margin:20px auto;background:#ffffff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

        <!-- Header -->
        <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;font-size:28px;font-weight:bold;padding:30px;border-radius:16px 16px 0 0;text-align:center;">
          📊 Daily Stock Insights
        </div>

        <div style="padding:20px 30px 10px 30px;">
          <div style="color:#777;font-size:14px;">
            Generated: ${new Date(date).toLocaleString('en-IN', { 
              day: 'numeric', 
              month: 'short', 
              year: 'numeric', 
              hour: 'numeric', 
              minute: 'numeric', 
              hour12: true 
            })}
          </div>
        </div>

        <!-- Overall Summary -->
        <div style="padding:10px 30px 20px 30px;">
          <div style="background:#f8f9fa;padding:20px;border-radius:12px;border-left:5px solid #667eea;">
            <div style="font-size:18px;font-weight:bold;color:#2c3e50;margin-bottom:10px;">💡 Portfolio Summary</div>
            <div style="font-size:15px;color:#555;line-height:1.7;">
              ${portfolioStatus}
              ${totalPnL !== 0 ? ` Today, your total ${totalPnL >= 0 ? 'profit' : 'loss'} is ₹${Math.abs(totalPnL).toFixed(2)}.` : ''}
            </div>
          </div>
        </div>

        <!-- Stock Details -->
        <div style="padding:0 30px 20px 30px;">
          ${stockSectionsHTML}
        </div>

        <!-- Overall Market Context -->
        <div style="padding:0 30px 20px 30px;">
          <div style="background:#fff9e6;padding:20px;border-radius:12px;border-left:5px solid #f39c12;">
            <div style="font-size:18px;font-weight:bold;color:#2c3e50;margin-bottom:10px;">🌍 Market Context</div>
            <div style="font-size:14px;color:#555;line-height:1.7;">
              ${this.renderEmailMarkdown(overallSummary)}
            </div>
          </div>
        </div>

        <!-- Recommendation -->
        <div style="padding:0 30px 20px 30px;">
          <div style="background:#e8f5e9;padding:20px;border-radius:12px;border-left:5px solid #27ae60;">
            <div style="font-size:18px;font-weight:bold;color:#2c3e50;margin-bottom:10px;">🧭 Recommendation</div>
            <div style="font-size:14px;color:#555;line-height:1.7;">
              ${this.generateRecommendation(holdings, analysis)}
            </div>
          </div>
        </div>

        <!-- Disclaimer -->
        <div style="padding:0 30px 30px 30px;">
          <div style="background:#fff3cd;color:#856404;padding:15px;border-radius:8px;font-size:13px;line-height:1.5;">
            ⚠️ <strong>Disclaimer:</strong> This analysis is for informational purposes only. Please consult a certified financial advisor before making investment decisions.
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:0 30px 30px 30px;">
          <div style="font-size:12px;color:#999;text-align:center;border-top:1px solid #e0e0e0;padding-top:20px;">
            Powered by AI Trading Platform
          </div>
        </div>

      </div>

    </body>
    </html>
    `;
  }

  /**
   * Generate personalized recommendation
   */
  static generateRecommendation(holdings, analysis) {
    const totalHoldings = holdings.length;
    const avgPnLPercent = this.safeNumber(analysis?.avgPnLPercent || 0);
    
    // Separate holdings and positions
    const longTermHoldings = holdings.filter(h => h.holding_type === 'HOLDING');
    const activePositions = holdings.filter(h => h.holding_type === 'POSITION');

    let recommendation = "";

    // Position-specific advice
    if (activePositions.length > 0) {
      const positionPnL = activePositions.reduce((sum, p) => sum + this.safeNumber(p.pnl), 0);
      if (positionPnL < -500) {
        recommendation += `⚠️ <strong>Active Positions Alert:</strong> Your ${activePositions.length} position${activePositions.length > 1 ? 's' : ''} showing loss of ₹${Math.abs(positionPnL).toFixed(2)}. Review stop-losses. `;
      } else if (positionPnL > 500) {
        recommendation += `✅ <strong>Positions Update:</strong> Your positions show profit of ₹${positionPnL.toFixed(2)}. Consider booking partial profits. `;
      }
    }

    // Holdings-specific advice
    if (longTermHoldings.length === 1) {
      const holding = longTermHoldings[0];
      const pnlPercent = this.safeNumber(holding.pnl_percentage);
      
      if (Math.abs(pnlPercent) < 2) {
        recommendation += `No immediate action needed. Consider adding more stocks to reduce risk. Having only one long-term holding means high concentration risk.`;
      } else if (pnlPercent > 5) {
        recommendation += `Your stock is performing well! Consider diversifying with 2-3 more quality stocks to reduce concentration risk.`;
      } else if (pnlPercent < -5) {
        recommendation += `Review your investment thesis. Consider diversifying with other quality stocks to spread risk.`;
      }
    } else if (longTermHoldings.length <= 3) {
      const holdingsPnL = longTermHoldings.reduce((sum, h) => sum + this.safeNumber(h.pnl_percentage), 0) / longTermHoldings.length;
      
      if (holdingsPnL > 3) {
        recommendation += `Portfolio performing well! Consider adding 1-2 more quality stocks for better diversification.`;
      } else if (holdingsPnL < -3) {
        recommendation += `Review each position individually. Quality stocks can recover - stick to your investment thesis.`;
      } else {
        recommendation += `Portfolio stable. Gradually build to 5-7 stocks for optimal diversification.`;
      }
    } else {
      if (avgPnLPercent > 5) {
        recommendation += `Excellent performance! Consider booking partial profits in stocks with >15% gains and rebalancing.`;
      } else if (avgPnLPercent < -5) {
        recommendation += `Portfolio needs attention. Review loss-makers - cut losses where fundamentals deteriorated, hold quality stocks facing temporary weakness.`;
      } else {
        recommendation += `Well-diversified and stable. Continue monitoring regularly and stay invested long-term.`;
      }
    }

    return recommendation || `Monitor your positions regularly and stay informed. Invest consistently and think long-term.`;
  }
}