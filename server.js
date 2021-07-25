const express = require("express");

const server = express();

server.all("/", (req, res) => {
  res.send("Bot is running!");
})

const keepAlive = () => {
  server.listen(process.env.PORT || 3000, () => {
    console.log(process.env.PORT || 3000);
  })
}


module.exports = keepAlive;