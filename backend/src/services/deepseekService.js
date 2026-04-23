const OpenAI = require("openai")

const client = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: "TA_CLE_API"
})

async function analyseEmail(mailContext){

const prompt = `
Analyse cet email et résume la demande.

From: ${mailContext.from}
Subject: ${mailContext.subject}
Body: ${mailContext.body}

Réponds en JSON avec:
summary
action
`

const response = await client.chat.completions.create({
  model: "deepseek-chat",
  messages: [
    { role: "user", content: prompt }
  ]
})

return response.choices[0].message.content
}

module.exports = {
  analyseEmail
}