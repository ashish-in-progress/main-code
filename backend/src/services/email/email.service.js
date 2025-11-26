import nodemailer from "nodemailer";
import MarkdownIt from "markdown-it";
import { logger } from "../../utils/logger.js";

export class EmailService {
  static transporter = null;

  // Markdown engine
  static md = new MarkdownIt({
    html: false,
    breaks: true,
    linkify: true,
  });

  /**
   * Convert Markdown → Email-Safe HTML
   */
  static renderEmailMarkdown(mdText = "") {
    if (!mdText) return "";

    let html = this.md.render(mdText || "");

    // Convert <ul><li> → email-safe table bullets
    html = html.replace(/<ul>/g, '<table style="margin:8px 0;"><tbody>');
    html = html.replace(/<\/ul>/g, "</tbody></table>");
    html = html.replace(
      /<li>/g,
      '<tr><td style="font-size:15px;line-height:1.6;padding:4px 0;">• '
    );
    html = html.replace(/<\/li>/g, "</td></tr>");

    // Headings → styled divs
    html = html.replace(
      /<h1>(.*?)<\/h1>/g,
      '<div style="font-size:22px;font-weight:bold;margin:15px 0 10px;">$1</div>'
    );
    html = html.replace(
      /<h2>(.*?)<\/h2>/g,
      '<div style="font-size:20px;font-weight:bold;margin:12px 0 8px;">$1</div>'
    );
    html = html.replace(
      /<h3>(.*?)<\/h3>/g,
      '<div style="font-size:18px;font-weight:bold;margin:10px 0 6px;">$1</div>'
    );

    // Paragraphs
    html = html.replace(
      /<p>/g,
      '<p style="font-size:15px;line-height:1.6;margin:8px 0;">'
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
   * Send stock insights email
   */
  static async sendInsightsEmail(userEmail, insights) {
    if (!this.transporter) {
      this.initialize();
    }

    const htmlContent = this.generateInsightsHTML(insights);

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject: `📊 Your Daily Stock Insights - ${new Date().toLocaleDateString()}`,
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

  /**
   * Generate Beginner-Friendly Email Template
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
      portfolioStatus = `Your portfolio has only one stock (${holdings[0].symbol}). Because of this, any small change in ${holdings[0].symbol} affects the whole portfolio.`;
    } else if (avgPnLPercent > 0) {
      portfolioStatus = `Your portfolio is performing well with an average gain of ${avgPnLPercent.toFixed(2)}%. ${gainers} ${gainers === 1 ? 'stock is' : 'stocks are'} in profit and ${losers} ${losers === 1 ? 'is' : 'are'} in loss.`;
    } else {
      portfolioStatus = `Your portfolio is showing an average loss of ${Math.abs(avgPnLPercent).toFixed(2)}%. ${losers} ${losers === 1 ? 'stock is' : 'stocks are'} in loss and ${gainers} ${gainers === 1 ? 'is' : 'are'} in profit.`;
    }

    // Generate individual stock sections
    let stockSectionsHTML = holdings
      .map((holding) => {
        const avgPrice = this.safeNumber(holding.average_price);
        const currentPrice = this.safeNumber(holding.current_price);
        const pnl = this.safeNumber(holding.pnl);
        const pnlPercentage = this.safeNumber(holding.pnl_percentage);
        const quantity = this.safeNumber(holding.quantity);
        const rsi = holding.technical?.rsi;

        // Performance message
        let performanceMsg = "";
        if (Math.abs(pnlPercentage) < 1) {
          performanceMsg = `${holding.symbol} is ${pnlPercentage >= 0 ? 'slightly up' : 'slightly down'} by ${Math.abs(pnlPercentage).toFixed(2)}%, but this is a very small movement and not something to worry about.`;
        } else if (pnlPercentage > 0) {
          performanceMsg = `${holding.symbol} is performing well, up by ${pnlPercentage.toFixed(2)}%. This is a positive sign.`;
        } else {
          performanceMsg = `${holding.symbol} is down by ${Math.abs(pnlPercentage).toFixed(2)}%. ${Math.abs(pnlPercentage) > 5 ? 'This needs attention.' : 'This is a normal market movement.'}`;
        }

        // Technical explanation
        let technicalMsg = "";
        if (rsi) {
          if (rsi > 70) {
            technicalMsg = `The stock's RSI is ${rsi.toFixed(0)}, which means it may be "overbought" - price has risen a lot recently and could fall.`;
          } else if (rsi < 30) {
            technicalMsg = `The stock's RSI is ${rsi.toFixed(0)}, which means it may be "oversold" - price has fallen a lot and could bounce back.`;
          } else if (rsi >= 60) {
            technicalMsg = `The stock's RSI is ${rsi.toFixed(0)}, which means the price has been rising recently but is not in a danger zone.`;
          } else if (rsi <= 40) {
            technicalMsg = `The stock's RSI is ${rsi.toFixed(0)}, which means the price has been falling but may stabilize soon.`;
          } else {
            technicalMsg = `The stock's RSI is ${rsi.toFixed(0)}, which is in a neutral zone - no extreme movements expected.`;
          }
        }

        // News section
        let newsHTML = "";
        if (holding.news && holding.news.length > 0) {
          const topNews = holding.news.slice(0, 3);
          newsHTML = topNews
            .map(
              (n) =>
                `<tr><td style="padding:6px 0;font-size:14px;line-height:1.5;">• <a href="${n.url}" style="color:#3498db;text-decoration:none;">${n.title}</a></td></tr>`
            )
            .join("");
        } else {
          newsHTML = `<tr><td style="padding:6px 0;font-size:14px;color:#777;">No recent news available for ${holding.symbol}</td></tr>`;
        }

        return `
          <tr>
            <td style="padding:20px;background:#ffffff;border-radius:12px;border:1px solid #e0e0e0;">
              
              <!-- Stock Header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:bold;color:#2c3e50;">
                    ${holding.symbol}
                  </td>
                  <td align="right" style="font-size:18px;font-weight:bold;color:${pnl >= 0 ? "#27ae60" : "#e74c3c"};">
                    ${pnl >= 0 ? "📈" : "📉"} ${pnlPercentage >= 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%
                  </td>
                </tr>
              </table>

              <div style="margin-top:12px;padding:12px;background:#f8f9fa;border-radius:8px;border-left:4px solid ${pnl >= 0 ? "#27ae60" : "#e74c3c"};">
                <div style="font-size:15px;color:#555;line-height:1.6;">${performanceMsg}</div>
              </div>

              <!-- Basic Details -->
              <div style="margin-top:15px;">
                <div style="font-size:16px;font-weight:bold;color:#34495e;margin-bottom:8px;">📊 Your Position</div>
                <table style="width:100%;font-size:14px;color:#555;">
                  <tr>
                    <td style="padding:4px 0;">• You bought <strong>${quantity} shares</strong> at ₹${avgPrice.toFixed(2)} each</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;">• Current price is <strong>₹${currentPrice.toFixed(2)}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;">• Your total ${pnl >= 0 ? 'profit' : 'loss'} is <strong style="color:${pnl >= 0 ? "#27ae60" : "#e74c3c"};">₹${Math.abs(pnl).toFixed(2)}</strong></td>
                  </tr>
                </table>
              </div>

              ${technicalMsg ? `
              <div style="margin-top:15px;padding:12px;background:#e8f4f8;border-radius:8px;">
                <div style="font-size:16px;font-weight:bold;color:#34495e;margin-bottom:6px;">📈 Technical Signal</div>
                <div style="font-size:14px;color:#555;line-height:1.6;">${technicalMsg}</div>
              </div>
              ` : ''}

              <!-- News Section -->
              <div style="margin-top:15px;">
                <div style="font-size:16px;font-weight:bold;color:#34495e;margin-bottom:8px;">📰 Latest News</div>
                <table style="width:100%;">
                  ${newsHTML}
                </table>
              </div>

              <!-- AI Insights -->
              <div style="margin-top:15px;padding:12px;background:#f0f9ff;border-radius:8px;border-left:4px solid #3498db;">
                <div style="font-size:16px;font-weight:bold;color:#34495e;margin-bottom:8px;">🤖 What AI Says (Simple Version)</div>
                <div style="font-size:14px;color:#555;line-height:1.7;">
                  ${this.renderEmailMarkdown(holding.aiInsight)}
                </div>
              </div>

            </td>
          </tr>
          <tr><td style="height:20px;"></td></tr>
        `;
      })
      .join("");

    return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

      <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
        <tr><td align="center">

          <table width="650" style="background:#ffffff;border-radius:16px;padding:0;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;font-size:28px;font-weight:bold;padding:30px;border-radius:16px 16px 0 0;text-align:center;">
                📊 Daily Stock Insights
              </td>
            </tr>

            <tr>
              <td style="padding:20px 30px 10px 30px;">
                <div style="color:#777;font-size:14px;">
                  Generated on: ${new Date(date).toLocaleString('en-IN', { 
                    day: 'numeric', 
                    month: 'numeric', 
                    year: 'numeric', 
                    hour: 'numeric', 
                    minute: 'numeric', 
                    hour12: true 
                  })}
                </div>
              </td>
            </tr>

            <!-- Overall Summary -->
            <tr>
              <td style="padding:10px 30px 20px 30px;">
                <div style="background:#f8f9fa;padding:20px;border-radius:12px;border-left:5px solid #667eea;">
                  <div style="font-size:18px;font-weight:bold;color:#2c3e50;margin-bottom:10px;">💡 Summary</div>
                  <div style="font-size:15px;color:#555;line-height:1.7;">
                    ${portfolioStatus}
                    ${totalPnL !== 0 ? ` Today, your total ${totalPnL >= 0 ? 'profit' : 'loss'} is ₹${Math.abs(totalPnL).toFixed(2)}.` : ''}
                  </div>
                </div>
              </td>
            </tr>

            <!-- Stock Details -->
            <tr>
              <td style="padding:0 30px 20px 30px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${stockSectionsHTML}
                </table>
              </td>
            </tr>

            <!-- Overall Market Context -->
            <tr>
              <td style="padding:0 30px 20px 30px;">
                <div style="background:#fff9e6;padding:20px;border-radius:12px;border-left:5px solid #f39c12;">
                  <div style="font-size:18px;font-weight:bold;color:#2c3e50;margin-bottom:10px;">🌍 Market Context</div>
                  <div style="font-size:14px;color:#555;line-height:1.7;">
                    ${this.renderEmailMarkdown(overallSummary)}
                  </div>
                </div>
              </td>
            </tr>

            <!-- Recommendation -->
            <tr>
              <td style="padding:0 30px 20px 30px;">
                <div style="background:#e8f5e9;padding:20px;border-radius:12px;border-left:5px solid #27ae60;">
                  <div style="font-size:18px;font-weight:bold;color:#2c3e50;margin-bottom:10px;">🧭 Recommendation</div>
                  <div style="font-size:14px;color:#555;line-height:1.7;">
                    ${this.generateRecommendation(holdings, analysis)}
                  </div>
                </div>
              </td>
            </tr>

            <!-- Disclaimer -->
            <tr>
              <td style="padding:0 30px 30px 30px;">
                <div style="background:#fff3cd;color:#856404;padding:15px;border-radius:8px;font-size:13px;line-height:1.5;">
                  ⚠️ <strong>Disclaimer:</strong> This analysis is for informational purposes only and should not be considered as financial advice. Please consult with a certified financial advisor before making investment decisions.
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:0 30px 30px 30px;">
                <div style="font-size:12px;color:#999;text-align:center;border-top:1px solid #e0e0e0;padding-top:20px;">
                  Powered by AI Trading Platform | <a href="#" style="color:#667eea;text-decoration:none;">Manage Preferences</a>
                </div>
              </td>
            </tr>

          </table>

        </td></tr>
      </table>

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

    if (totalHoldings === 1) {
      const holding = holdings[0];
      const pnlPercent = this.safeNumber(holding.pnl_percentage);
      
      if (Math.abs(pnlPercent) < 2) {
        return `You don't need to take action right now. But in the future, consider adding more stocks to reduce risk. Having only one stock means your portfolio is highly dependent on that single company's performance.`;
      } else if (pnlPercent > 5) {
        return `Your stock is performing well! However, consider diversifying by adding 2-3 more stocks to reduce concentration risk. Don't put all your eggs in one basket.`;
      } else if (pnlPercent < -5) {
        return `Your stock is showing losses. Consider reviewing why you invested and whether the fundamentals have changed. Also, think about diversifying with other stocks to spread risk.`;
      }
    } else if (totalHoldings <= 3) {
      if (avgPnLPercent > 3) {
        return `Your portfolio is doing well! Keep monitoring your positions and consider adding 1-2 more quality stocks for better diversification.`;
      } else if (avgPnLPercent < -3) {
        return `Your portfolio is showing overall losses. Review each position individually and consider whether to hold, average down, or exit. Stick to your investment thesis.`;
      } else {
        return `Your portfolio is stable. No immediate action needed. Continue monitoring and consider gradually building a more diversified portfolio of 5-7 stocks.`;
      }
    } else {
      if (avgPnLPercent > 5) {
        return `Excellent portfolio performance! Consider booking partial profits in stocks that have gained significantly (>15%) and rebalancing your portfolio.`;
      } else if (avgPnLPercent < -5) {
        return `Your portfolio needs attention. Review loss-making positions - cut losses on stocks where fundamentals have deteriorated, but hold quality stocks going through temporary weakness.`;
      } else {
        return `Your portfolio is well-diversified and stable. Continue your current strategy and keep monitoring positions regularly. Stay invested for the long term.`;
      }
    }

    return `Keep monitoring your positions and stay informed about market developments. Invest regularly and think long-term.`;
  }
}