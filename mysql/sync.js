import UsersModel from "../models/users-model.js";
import EmployeesModel from "../models/employees-model.js";
import ChatsModel from "../models/chats-model.js";
import MessagesModel from "../models/messages-model.js";
import ChatParticipantsModel from "../models/chat-participants-model.js";
import MessageReadsModel from "../models/message-reads-model.js";
import MediaMetadataModel from "../models/media-metadata-model.js";


const DEVE_ENV = process.env?.NODE_ENV === "development" ? true : false;

export const sync = async () => {

    console.log("syncing mysql tables " + DEVE_ENV);
    if (!DEVE_ENV) { return; }
    
    console.log("dev mode: syncing mysql tables");

    
    // await RegistrationsModel.sync();
    await UsersModel.sync();
    await EmployeesModel.sync();
    await ChatsModel.sync();
    await MessagesModel.sync();
    await ChatParticipantsModel.sync();
    await MessageReadsModel.sync();
    await MediaMetadataModel.sync();

    console.log("mysql table synced");
};