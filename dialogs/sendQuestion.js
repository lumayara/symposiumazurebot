// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints, MessageFactory } = require('botbuilder');
const { ConfirmPrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');


const CosmosClient = require('@azure/cosmos').CosmosClient;
const config = require('../config');
const nodemailer = require('nodemailer');

const endpoint = config.endpoint;
const key = config.key;

const databaseId = config.database.id;
const container2Id = config.container2.id;
const client = new CosmosClient({ endpoint, key });

/**
 * Create user item if it does not exist
 */
async function submitQuestion(request) {
    const { item } = await client
      .database(databaseId)
      .container(container2Id)
      .items.upsert({
        email: request.user.mail,
        question: request.question
        });
    sendEmail(request);
}


function sendEmail(request) {
//transporter is a way to send your emails
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        port:465,
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASSWORD
        },
        tls:{
            rejectUnauthorized:false
        }
    });

    // setup email data with unicode symbols
    //this is how your email are going to look like
    const mailOptions = {
        from: '"Symposium 2020" <noreply@companyinc.com>', // sender address
        to: process.env.RECEIVER, // list of receivers
        subject: 'New Question', // Subject line
        // text: "hi", // plain text body
        html: "Email: "+request.user.mail+
                "<br>Question:"+ request.question+ "<br><br>"
    };

    //this is callback function to return status to firebase console
    const getDeliveryStatus = function (error, info) {
        if (error) {
            return console.log(error);
        }
        console.log('Message sent: %s', info.messageId);
    };

    //call of this function send an email, and return status
    transporter.sendMail(mailOptions, getDeliveryStatus);
};


const CONFIRM_PROMPT = 'confirmPrompt';
const TEXT_PROMPT = 'textPrompt';
const WATERFALL_DIALOG = 'waterfallDialog';

class sendQuestion extends CancelAndHelpDialog {
    constructor(id) {
        super(id || 'sendQuestion');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.questionStep.bind(this),
                this.confirmStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * If a destination city has not been provided, prompt for one.
     */
    async questionStep(stepContext) {
        const rsvpDetails = stepContext.options;

        if (!rsvpDetails.question) {
            const messageText = "What's your question?";
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(rsvpDetails.question);
    }

    /**
     * Confirm the information the user has provided.
     */
    async confirmStep(stepContext) {
        const rsvpDetails = stepContext.options;

        // Capture the results of the previous step
        rsvpDetails.question = stepContext.result;
        const messageText = `Do you wish to send your question: ${rsvpDetails.question}?`;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);

        // Offer a YES/NO prompt.
        return await stepContext.prompt(CONFIRM_PROMPT, { prompt: msg });
    }

    /**
     * Complete the interaction and end the dialog.
     */
    async finalStep(stepContext) {
        if (stepContext.result === true) {
            submitQuestion(stepContext.options);
            const rsvpDetails = stepContext.options;
            return await stepContext.endDialog("question");
            // return await stepContext.endDialog(rsvpDetails);
        }
        return await stepContext.endDialog();
    }
}

module.exports.sendQuestion = sendQuestion;
