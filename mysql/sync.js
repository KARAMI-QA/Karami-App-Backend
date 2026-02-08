import UsersModel from "../models/users-model.js";
import EmployeesModel from "../models/employees-model.js";
import ChatsModel from "../models/chats-model.js";
import MessagesModel from "../models/messages-model.js";
import ChatParticipantsModel from "../models/chat-participants-model.js";
import MessageReadsModel from "../models/message-reads-model.js";
import ApprovalLogsModel from "../models/approval-logs-model.js";
import RolesModel from "../models/roles-model.js";
import ModelHasRolesModel from "../models/model-has-roles-model.js";
import LeavesModel from "../models/leaves-model.js";
import LoansModel from "../models/loans-model.js";
import ReimbursementsModel from "../models/reimbursements-model.js";
import AdvanceSalariesModel from "../models/advance-salaries-model.js";
import ManualLogsModel from "../models/manual-logs-model.js";
import OvertimeLogsModel from "../models/overtime-logs-model.js";
import MediaMetadataModel from "../models/media-metadata-model.js";

//for approval logs models


const DEVE_ENV = process.env?.NODE_ENV === "development" ? true : false;

export const sync = async () => {

    console.log("syncing mysql tables " + DEVE_ENV);
    if (!DEVE_ENV) { return; }
    
    console.log("dev mode: syncing mysql tables");

    
    // for main models and chat
    await UsersModel.sync();
    await EmployeesModel.sync();
    await ChatsModel.sync();
    await MessagesModel.sync();
    await ChatParticipantsModel.sync();
    await MessageReadsModel.sync();
    await MediaMetadataModel.sync();

    //for approval logs models
    await ApprovalLogsModel.sync();
    await RolesModel.sync();
    await ModelHasRolesModel.sync();
    await LeavesModel.sync();
    await LoansModel.sync();
    await ReimbursementsModel.sync();
    await AdvanceSalariesModel.sync();
    await ManualLogsModel.sync();
    await OvertimeLogsModel.sync(); 

    console.log("mysql table synced");
};