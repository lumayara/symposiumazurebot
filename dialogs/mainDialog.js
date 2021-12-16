// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { MessageFactory, InputHints } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { ComponentDialog, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';

class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, tasksDialog, cancelRSVP, sendQuestion) {
        super('MainDialog');

        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;

        if (!tasksDialog) throw new Error('[MainDialog]: Missing parameter \'tasksDialog\' is required');

        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(tasksDialog)
            .addDialog(cancelRSVP)
            .addDialog(sendQuestion)
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.actStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a booking request, like "book me a flight from Paris to Berlin on march 22"
     * Note that the sample LUIS model will only recognize Paris, Berlin, New York and London as airport cities.
     */
    async introStep(stepContext) {
        const user = {mail: stepContext.context._activity.from.id, displayName: stepContext.context._activity.from.name};

        if (!this.luisRecognizer.isConfigured) {
            const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await stepContext.next();
        }

        const messageText = stepContext.options.restartMsg ? stepContext.options.restartMsg : "Hi, "+stepContext.context._activity.from.name+"! How can I help you? You can say: \nRSVP, \nCancel my RSVP, \nSee who's attending, \nWhen and where is the event, \nAdd event to my calendar or \nQuestion for company.";
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt('TextPrompt', { prompt: promptMessage });
    }

    /**
     * Second step in the waterfall.  This will use LUIS to attempt to extract the origin, destination and travel dates.
     * Then, it hands off to the tasksDialog child dialog to collect any remaining details.
     */
    async actStep(stepContext) {
        const bookingDetails = {};
        const user = {mail: stepContext.context._activity.from.id, displayName: stepContext.context._activity.from.name};

        if (!this.luisRecognizer.isConfigured) {
            // LUIS is not configured, we just run the TasksDialog path.
            return await stepContext.beginDialog('tasksDialog', bookingDetails);
        }

        // Call LUIS and gather any potential booking details. (Note the TurnContext has the response to the prompt)
        const luisResult = await this.luisRecognizer.executeLuisQuery(stepContext.context);
        switch (LuisRecognizer.topIntent(luisResult)) {
        case 'RSVPIntent': {
            // Extract the values for the composite entities from the LUIS result.
            bookingDetails.user = user;

            console.log('LUIS extracted these booking details:', JSON.stringify(bookingDetails));

            // Run the TasksDialog passing in whatever details we have from the LUIS call, it will fill out the remainder.
            return await stepContext.beginDialog('tasksDialog', bookingDetails);
        }
        case 'CancelIntent': {
            // Extract the values for the composite entities from the LUIS result.
            bookingDetails.user = user;

            console.log('LUIS extracted these booking details:', JSON.stringify(bookingDetails));

            // Run the TasksDialog passing in whatever details we have from the LUIS call, it will fill out the remainder.
            return await stepContext.beginDialog('cancelRSVP', bookingDetails);
        }

        case 'GetParticipantsIntent': {

            if (!this.luisRecognizer.isConfigured) {
                const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
                await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
                return await stepContext.next();
            }

            // We haven't implemented the GetWeatherDialog so we just display a TODO message.
            const getWeatherMessageText = `To see the participants, please click on this link: `+
                `https://companysymp2020.azurewebsites.net/attendees`;
            await stepContext.context.sendActivity(getWeatherMessageText, getWeatherMessageText, InputHints.IgnoringInput);
            break;
        }
        case 'GreetingsIntent': {

            if (!this.luisRecognizer.isConfigured) {
                const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
                await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
                return await stepContext.next();
            }

            // We haven't implemented the GetWeatherDialog so we just display a TODO message.
            const getWeatherMessageText = `Hi, ${stepContext.context._activity.from.name}! How can I help you today?`;
            await stepContext.context.sendActivity(getWeatherMessageText, getWeatherMessageText, InputHints.IgnoringInput);
            break;
        }
        case 'AddCalendarIntent': {

            if (!this.luisRecognizer.isConfigured) {
                const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
                await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
                return await stepContext.next();
            }

            // We haven't implemented the GetWeatherDialog so we just display a TODO message.
            const getWeatherMessageText = `Please click [here](https://symposiumfiles.blob.core.windows.net/calendar/company_Symposium_2020.ics) to download the .ics calendar file.`;
            await stepContext.context.sendActivity(getWeatherMessageText, getWeatherMessageText, InputHints.IgnoringInput);
            break;
        }
        case 'EventDetailsIntent': {
            if (!this.luisRecognizer.isConfigured) {
                const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
                await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
                return await stepContext.next();
            }

            // We haven't implemented the GetWeatherDialog so we just display a TODO message.
            const getWeatherMessageText = `company's Symposium 2020 will be held on Wednesday, April 8th 2020 from 12:30pm to 5pm.\n Location: `+
                `Bethesda North Marriott Hotel & Conference Center​ 5701 Marinelli Road, Rockville, Maryland 20852.\n`+
                `Room Number: {Will be Provided}. \nClick here for Directions: https://goo.gl/maps/fM5LC756wUby6BCb7. See you there!`;
            await stepContext.context.sendActivity(getWeatherMessageText, getWeatherMessageText, InputHints.IgnoringInput);
            break;
        }

        case 'QuestionIntent': {
            // Extract the values for the composite entities from the LUIS result.
            bookingDetails.user = user;

            console.log('LUIS extracted these booking details:', JSON.stringify(bookingDetails));

            // Run the TasksDialog passing in whatever details we have from the LUIS call, it will fill out the remainder.
            return await stepContext.beginDialog('sendQuestion', bookingDetails);
        }

        default: {
            // Catch all for unhandled intents
            const didntUnderstandMessageText = `Sorry, I didn't get that. Please try asking in a different way.`;
            await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);
        }
        }

        return await stepContext.next();
    }

    /**
     * This is the final step in the main waterfall dialog.
     * It wraps up the sample "book a flight" interaction with a simple confirmation.
     */
    async finalStep(stepContext) {
        // If the child dialog ("tasksDialog") was cancelled or the user failed to confirm, the Result here will be null.
        if (stepContext.result) {
            const result = stepContext.result;
            console.log("result");
            console.log(result);
            // Now we have all the booking details.

            // This is where calls to the booking AOU service or database would go.
            if(result == "cancel"){
                const msg = `You have changed your RSVP to "Not Going".`;
                await stepContext.context.sendActivity(msg, msg, InputHints.IgnoringInput);
            } else if(result == "question"){
                // If the call to the booking service was successful tell the user.
                const msg = `I have successfully sent your question to our company members!`;
                await stepContext.context.sendActivity(msg, msg, InputHints.IgnoringInput);
            }
            else{
                // If the call to the booking service was successful tell the user.
                const msg = `You are registered for company's Symposium 2020. See you there!`;
                await stepContext.context.sendActivity(msg, msg, InputHints.IgnoringInput);
            }
            
        }

        // Restart the main dialog with a different message the second time around
        return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: `If you wish to do anything else, please give me a command.` });
    }
}

module.exports.MainDialog = MainDialog;
