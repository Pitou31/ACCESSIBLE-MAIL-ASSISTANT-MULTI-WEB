async function analyseEmail(mailContext){

const text = (mailContext.body || "").toLowerCase()

let category = "autre"
let priority = "normal"
let summary = "Message général."

// PRIORITÉ
if(text.includes("urgent")){
priority = "urgent"
}

if(text.includes("relance") || text.includes("répondre à ma demande précédente") || text.includes("demande précédente")){
category = "relance"
summary = "La personne relance une demande précédente."
}

// DOCUMENT
else if(text.includes("document")){
category = "demande_document"
summary = "La personne demande l'envoi d'un document."
}

// FACTURE
else if(text.includes("facture")){
category = "question_facture"
summary = "La personne pose une question sur une facture."
}

// INFORMATION
else if(text.includes("information") || text.includes("renseignement")){
category = "demande_information"
summary = "La personne demande des informations."
}

// PROBLÈME
else if(text.includes("problème") || text.includes("erreur")){
category = "réclamation"
summary = "La personne signale un problème."
}

const nom = mailContext.from || "Madame, Monsieur"

const replies = {

court:
`Bonjour ${nom},

Nous avons bien reçu votre message.

Cordialement`,

professionnel:
`Bonjour ${nom},

Nous avons bien reçu votre message et nous vous remercions pour votre prise de contact.

Nous revenons vers vous dans les meilleurs délais.

Bien cordialement`,

chaleureux:
`Bonjour ${nom},

Merci pour votre message.

Nous prenons en compte votre demande et revenons vers vous rapidement.

Très bonne journée`
}

return {
category,
priority,
summary,
replies
}

}

module.exports = {
analyseEmail
}