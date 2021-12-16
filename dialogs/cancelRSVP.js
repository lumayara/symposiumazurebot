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

async function updateRSVP(request) {
    var clientName;
      if(request.user.displayName.indexOf('(')){
       clientName = request.user.displayName.substr(0, request.user.displayName.indexOf('(')-1);
      };
    clientName = clientName?clientName:request.user.displayName
   client.database(databaseId).container(containerId)
   .item(request.user.mail, clientName).read().then(function(result){
        result.resource.rsvp = "no";
        client.database(databaseId)
        .container(containerId)
        .item(request.user.mail, clientName)
        .replace(result.resource);
        sendEmail(request);
   });
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
                subject: 'RSVP Cancelation', // Subject line
                // text: "hi", // plain text body
                html: "Email: "+request.user.mail+ "<br>RSVP: No<br><br>"
            };
        
            //this is callback function to return status to firebase console
            const getDeliveryStatus = function (error, info) {
                if (error) {
                    return console.log(error);
                }
                console.log('Message sent: %s', info.messageId);
                // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
            };
        
            //call of this function send an email, and return status
            transporter.sendMail(mailOptions, getDeliveryStatus);
        };
    

const CONFIRM_PROMPT = 'confirmPrompt';
const TEXT_PROMPT = 'textPrompt';
const WATERFALL_DIALOG = 'waterfallDialog';

class cancelRSVP extends CancelAndHelpDialog {
    constructor(id) {
        super(id || 'cancelRSVP');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.confirmStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }


    /**
     * Confirm the information the user has provided.
     */
    async confirmStep(stepContext) {
        const rsvpDetails = stepContext.options;

        // Capture the results of the previous step
        rsvpDetails.interests = stepContext.result;
        const messageText = `Are you sure you want to cancel your RSVP?`;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);

        // Offer a YES/NO prompt.
        return await stepContext.prompt(CONFIRM_PROMPT, { prompt: msg });
    }

    /**
     * Complete the interaction and end the dialog.
     */
    async finalStep(stepContext) {
        if (stepContext.result === true) {
            updateRSVP(stepContext.options);
            return await stepContext.endDialog("cancel");
        }
        return await stepContext.endDialog();
    }
}

module.exports.cancelRSVP = cancelRSVP;
