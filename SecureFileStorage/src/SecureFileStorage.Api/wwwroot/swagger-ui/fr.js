(function () {
    const traductions = {
        "Authorize": "Autoriser",
        "Available authorizations": "Autorisations disponibles",
        "Authorize by entering your bearer token": "Entrez votre jeton Bearer pour vous authentifier",
        "Bearer (http, Bearer)": "Jeton Bearer (HTTP)",
        "Value:": "Valeur :",
        "Close": "Fermer",
        "Logout": "Déconnexion",
        "Try it out": "Essayer",
        "Cancel": "Annuler",
        "Execute": "Exécuter",
        "Clear": "Effacer",
        "Parameters": "Paramètres",
        "No parameters": "Aucun paramètre",
        "Request body": "Corps de la requête",
        "Responses": "Réponses",
        "Response body": "Corps de la réponse",
        "Response headers": "En-têtes de la réponse",
        "Download": "Télécharger",
        "Schema": "Schéma",
        "Example Value": "Exemple",
        "Model": "Modèle",
        "No response body": "Aucun corps de réponse",
        "Links": "Liens",
        "Name": "Nom",
        "Description": "Description",
        "Apply": "Appliquer",
        "Servers": "Serveurs",
        "Server": "Serveur",
        "Media type": "Type de contenu",
        "Controls Accept header.": "Contrôle l'en-tête Accept.",
        "Successful Response": "Réponse réussie",
        "Bad Request": "Requête incorrecte",
        "Unauthorized": "Non autorisé",
        "Forbidden": "Accès interdit",
        "Not Found": "Introuvable",
        "Conflict": "Conflit",
        "Internal Server Error": "Erreur serveur",
        "Code": "Code",
        "Details": "Détails",
        "string": "texte",
        "integer": "nombre entier",
        "boolean": "booléen",
        "object": "objet",
        "array": "liste",
        "Required": "Obligatoire",
        "Select a definition": "Choisir une définition",
        "Filter by tag": "Filtrer par catégorie",
        "Operations": "Opérations",
        "Find out more": "En savoir plus",
        "About Swagger": "À propos de Swagger",
        "Failed to fetch": "Échec de la requête",
        "Possible Values:": "Valeurs possibles :",
        "default": "par défaut"
    };

    function traduireNoeud(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            let texte = node.textContent;
            for (const [en, fr] of Object.entries(traductions)) {
                if (texte.includes(en)) {
                    texte = texte.split(en).join(fr);
                }
            }
            if (texte !== node.textContent) {
                node.textContent = texte;
            }
        } else {
            node.childNodes.forEach(traduireNoeud);
        }
    }

    function traduire() {
        traduireNoeud(document.body);
    }

    const observer = new MutationObserver(function () {
        traduire();
    });

    window.addEventListener("load", function () {
        traduire();
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        setTimeout(traduire, 500);
        setTimeout(traduire, 1500);
    });
})();
