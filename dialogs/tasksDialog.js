// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints, MessageFactory } = require('botbuilder');
const { ConfirmPrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const nodemailer = require('nodemailer');

const CosmosClient = require('@azure/cosmos').CosmosClient;
const config = require('../config');

const endpoint = config.endpoint;
const key = config.key;

const databaseId = config.database.id;
const containerId = config.container.id;
const client = new CosmosClient({ endpoint, key });

/**
 * Create user item if it does not exist
 */
async function createUser(request) {

    if(request.user){
      var clientName;
      if(request.user.displayName.indexOf('(')){
       clientName = request.user.displayName.substr(0, request.user.displayName.indexOf('(')-1);
      };
    const { item } = await client
      .database(databaseId)
      .container(containerId)
      .items.upsert({
        id: request.user.mail,
		email: request.user.mail,
        name: clientName?clientName:request.user.displayName,
        agency: request.agency,
        interests: request.interests,
        rsvp: "yes"
	});
    console.log(`Created item `);
    sendEmail(request);
    }
    
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
        subject: 'New User Registration', // Subject line
        // text: "hi", // plain text body
        html: "Email: "+request.user.mail+
                "<br>Agency:"+ request.agency+ "<br>RSVP: Yes<br>Interests: "+ request.interests+"<br><br>"
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

class TasksDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id || 'tasksDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.agencyStep.bind(this),
                this.interestStep.bind(this),
                this.confirmStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * If a destination city has not been provided, prompt for one.
     */
    async agencyStep(stepContext) {
        const rsvpDetails = stepContext.options;

        if (!rsvpDetails.agency) {
            const messageText = "What's your agency?";
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(rsvpDetails.interests);
    }

    /**
     * If an origin city has not been provided, prompt for one.
     */
    async interestStep(stepContext) {
        const rsvpDetails = stepContext.options;

        // Capture the response to the previous step's prompt
        rsvpDetails.agency = stepContext.result;
        if (!rsvpDetails.interests) {
            const messageText = 'What topics would you like to see?';
            const msg = MessageFactory.text(messageText, 'What are your topics of interest?', InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(rsvpDetails.interests);
    }

    /**
     * Confirm the information the user has provided.
     */
    async confirmStep(stepContext) {
        const rsvpDetails = stepContext.options;

        // Capture the results of the previous step
        rsvpDetails.interests = stepContext.result;
        const messageText = `Please confirm your RSVP, Your agency is: ${ rsvpDetails.agency } and topics of interest are: ${ rsvpDetails.interests }. Is this correct?`;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);

        // Offer a YES/NO prompt.
        return await stepContext.prompt(CONFIRM_PROMPT, { prompt: msg });
    }

    /**
     * Complete the interaction and end the dialog.
     */
    async finalStep(stepContext) {
        if (stepContext.result === true) {
            createUser(stepContext.options);
            const rsvpDetails = stepContext.options;
            return await stepContext.endDialog(rsvpDetails);
        }
        return await stepContext.endDialog();
    }
}

module.exports.TasksDialog = TasksDialog;
