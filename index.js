require("dotenv").config();
const Discord = require("discord.js");
const axios = require("axios");
const Pageres = require("pageres");
const fs = require("fs");
const keepAlive = require("./server");

const token = process.env["DISCORDJS_BOT_TOKEN"];
const apiKey = process.env["API_KEY"];
const client = new Discord.Client();
const PREFIX = "$";
let alertTradingChannel;
let start = false;
let round = 1;

const getCurrencyAnalysis = async (firstCurrency, secondCurrency) => {
  // const timeFrame = ["15min", "30min", "60min", "daily"];
  try {
    //MACD indicator
    const promisesMACD = ["30min", "60min", "daily"].map(async (tf) => {
      let url = `https://www.alphavantage.co/query?function=MACD&symbol=${
        firstCurrency + secondCurrency
        }&interval=${tf}&series_type=close&apikey=${apiKey}`;

      const res = await axios.default.get(url);
      const data = res.data;
      if (data && data.Note === undefined) {
        let lastRefresh;
        if (tf != "daily")
          lastRefresh = data["Meta Data"]["3: Last Refreshed"].substring(
            0,
            data["Meta Data"]["3: Last Refreshed"].length - 3
          );
        else lastRefresh = data["Meta Data"]["3: Last Refreshed"];
        const technicalAnalysis = data["Technical Analysis: MACD"][lastRefresh];
        let rs = {
          timeFrame: tf,
          date: lastRefresh,
          technicalAnalysis,
        };
        return rs;
      } else return data;
    });
    //RSI indicator
    const promisesRSI = ["60min", "daily"].map(async (tf) => {
      let url = `https://www.alphavantage.co/query?function=RSI&symbol=${
        firstCurrency + secondCurrency
        }&interval=${tf}&time_period=14&series_type=close&apikey=${apiKey}`;

      const res = await axios.default.get(url);
      const data = res.data;
      if (data && data.Note === undefined) {
        let lastRefresh;
        if (tf != "daily")
          lastRefresh = data["Meta Data"]["3: Last Refreshed"].substring(
            0,
            data["Meta Data"]["3: Last Refreshed"].length - 3
          );
        else lastRefresh = data["Meta Data"]["3: Last Refreshed"];
        const technicalAnalysis = data["Technical Analysis: RSI"][lastRefresh];
        let rs = {
          timeFrame: tf,
          date: lastRefresh,
          technicalAnalysis,
        };
        return rs;
      } else return data;
    });

    const dataRSI = await Promise.all(promisesRSI);
    const dataMACD = await Promise.all(promisesMACD);

    return { MACD: dataMACD, RSI: dataRSI };
  } catch (error) {
    console.log(error);
  }
};

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.id}!`);

  alertTradingChannel = client.channels.cache.find(
    (channel) => channel.id === "864566960624500776"
  );
  alertTradingChannel.send("Tao đã trở lại!!!");

  client.setInterval(async () => {
    if (!start) return;
    //!rest api, send mess here...............................
    const currencyList = ["GBP-USD", "GBP-JPY", "EUR-NZD", "USD-CAD"];
    let x = 60000;

    currencyList.forEach((coupleCurrency) => {
      x += 70000;
      try {
        const [firstCurrency, secondCurrency] = coupleCurrency.split("-");
        const timing = client.setTimeout(async () => {
          //Get MACD, RSI analysis
          const analysisData = await getCurrencyAnalysis(
            firstCurrency,
            secondCurrency
          );
          console.log(analysisData);
          //Caculate data for alert
          const { MACD, RSI } = analysisData;
          const tradeData = {
            currency: firstCurrency + secondCurrency,
            MACD: {},
            RSI: {},
          };
          MACD.forEach((anals) => {
            if (anals.timeFrame === "30min") {
              let readyToTrade = false;
              let signal = "Not yet";
              const MACD_Minus_MACDSignal = Math.abs(
                anals.technicalAnalysis.MACD -
                anals.technicalAnalysis.MACD_Signal
              );
              if (MACD_Minus_MACDSignal < 0.0005) {
                readyToTrade = true;
                signal =
                  anals.technicalAnalysis.MACD >
                    anals.technicalAnalysis.MACD_Signal
                    ? "Sell"
                    : "Buy";
              }
              tradeData.MACD[`${anals.timeFrame}`] = { readyToTrade, signal };
            }
            if (anals.timeFrame === "60min") {
              let readyToTrade = false;
              let signal = "Not yet";
              const MACD_Minus_MACDSignal = Math.abs(
                anals.technicalAnalysis.MACD -
                anals.technicalAnalysis.MACD_Signal
              );
              if (MACD_Minus_MACDSignal < 0.0005) {
                readyToTrade = true;
                signal =
                  anals.technicalAnalysis.MACD >
                    anals.technicalAnalysis.MACD_Signal
                    ? "Sell"
                    : "Buy";
              }
              tradeData.MACD[`${anals.timeFrame}`] = { readyToTrade, signal };
            }
            if (anals.timeFrame === "daily") {
              let readyToTrade = false;
              let signal = "Not yet";
              const MACD_Minus_MACDSignal = Math.abs(
                anals.technicalAnalysis.MACD -
                anals.technicalAnalysis.MACD_Signal
              );
              if (MACD_Minus_MACDSignal < 0.001) {
                readyToTrade = true;
                signal =
                  anals.technicalAnalysis.MACD >
                    anals.technicalAnalysis.MACD_Signal
                    ? "Sell"
                    : "Buy";
              }
              tradeData.MACD[`${anals.timeFrame}`] = { readyToTrade, signal };
            }
          });
          RSI.forEach((anals) => {
            if (anals.timeFrame === "60min") {
              let readyToTrade = false;
              let signal = "Not yet";
              if (
                anals.technicalAnalysis.RSI < 35 ||
                anals.technicalAnalysis.RSI > 65
              ) {
                readyToTrade = true;
                signal = anals.technicalAnalysis.RSI < 35 ? "Buy" : "Sell";
              }
              tradeData.RSI[`${anals.timeFrame}`] = { readyToTrade, signal };
            }
            if (anals.timeFrame === "daily") {
              let readyToTrade = false;
              let signal = "Not yet";
              if (
                anals.technicalAnalysis.RSI < 30 ||
                anals.technicalAnalysis.RSI > 70
              ) {
                readyToTrade = true;
                signal = anals.technicalAnalysis.RSI < 35 ? "Buy" : "Sell";
              }
              tradeData.RSI[`${anals.timeFrame}`] = { readyToTrade, signal };
            }
          });
          //data caculated
          console.log(tradeData);
          if (
            tradeData.MACD["30min"].readyToTrade &&
            tradeData.MACD["60min"].readyToTrade &&
            tradeData.MACD.daily.readyToTrade &&
            tradeData.RSI["60min"].readyToTrade &&
            tradeData.RSI.daily.readyToTrade
          ) {
            
          }
          //Alert
          const date = new Date().toISOString();
          const link =
            "https://vn.tradingview.com/chart?symbol=" + tradeData.currency;
          const name = date
            .split("-")
            .join("")
            .split(":")
            .join("")
            .split(".")
            .join("");
          await new Pageres({ delay: 2, filename: name })
            .src(
              "https://uk.tradingview.com/chart?symbol=" + tradeData.currency,
              ["1920x1080"]
            )
            .dest(__dirname)
            .run();
          const embed = new Discord.MessageEmbed()
            .setTitle("Trade Trade Trade!!!")
            .setColor("#e58e26")
            .setDescription(
              `\n<@410321759221579786> ` +
              date +
              "\n" +
              tradeData.currency +
              "\nWait " +
              tradeData.MACD.daily.signal +
              "\n" +
              link
            );
          await alertTradingChannel.send({
            files: [__dirname + `/${name}.png`],
            embed,
          });
          
          fs.unlink(__dirname + `/${name}.png`, (err) => {
            if (err) {
              throw err;
            }

            console.log("File is deleted.");
          });
          alertTradingChannel.send("Tao vẫn đang soi cặp " + tradeData.currency + " - Đừng nóng!");
        }, x);
      } catch (error) {
        console.log(error);
      }
    });

    alertTradingChannel.send(`Bây giờ là ${new Date().toUTCString()} - Round ${round}`);
    round += 1;
  }, 60000);
});

client.on("message", (msg) => {
  let { author, content, channel } = msg;
  if (author.bot) return;
  if (msg.content.startsWith(PREFIX)) {
    const [command, ...args] = msg.content
      .trim()
      .substring(PREFIX.length)
      .split(/\s+/);
    if (author.id == "410321759221579786") {
      switch (command) {
        case "start":
          start && msg.channel.send("Alert is running...");
          !start && msg.channel.send("Alert has started!");
          start = true;
          break;
        case "stop":
          start && msg.channel.send("Alert has stop!");
          !start && msg.channel.send("Alert already stop!");
          start = false;
          break;
      }
    } else msg.channel.send("Đừng hòng điểu khiển tao con chó giả danh.");
  }
});
keepAlive();
client.login(token);
