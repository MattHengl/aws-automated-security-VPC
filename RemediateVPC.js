/*!
     * Copyright 2017-2017 Mutual of Enumclaw. All Rights Reserved.
     * License: Public
*/ 

//Mutual of Enumclaw 
//
//Matthew Hengl and Jocelyn Borovich - 2019 :) :)
//
//Main file that controls remediation and notifications of all EC2 VPC events. 
//Remediates actions when possible or necessary based on launch type and tagging. Then, notifies the user/security. 

//Make sure to that the master.invalid call does NOT have a ! infront of it
//Make sure to delete or comment out the change in the process.env.environtment

const AWS = require('aws-sdk');
AWS.config.update({region: process.env.region});
const ec2 = new AWS.EC2();
const Master = require("aws-automated-master-class/MasterClass").handler;
let path = require("aws-automated-master-class/MasterClass").path;
const master = new Master();

let callRemediate = remediate;

//Only used for testing purposes
setEc2Function = (value, funct) => {
  ec2[value] = funct;
};

async function handleEvent(event){

  console.log(JSON.stringify(event));
  path.p = 'Path: \nEntered handleEvent';

  event = master.devTest(event);
  //Checks if there is an error in the log
  if (master.errorInLog(event)) {
    console.log(path.p);
    return; 
  }

  //Checks if the log came from this function, quits the program if it does.
  if (master.selfInvoked(event)) {
    console.log(path.p);
    return;
  }

  console.log(`Event action is ${event.detail.eventName}------------------------`);

  //if(master.checkKeyUser(event, findId(event))){
    //change this for when you're not testing in snd
    if(master.invalid(event)){
      try{
        await master.notifyUser(event, await callRemediate(event), 'VPC');
      }catch(e){
        console.log(e);
        path.p += '\nERROR';
        console.log(path.p);
        delete path.p;
        return e;
      }
    }
  //}
  console.log(path.p);
  delete path.p;
}

async function remediate(event){
  path.p += '\nEntered the remediation function';

  const erp = event.detail.requestParameters;
  const ere = event.detail.responseElements;

  let params = {};
  let results = master.getResults(event, {});

  try{
    switch(results.Action){
      //DONE!
      case 'CreateVpc':
        path.p += '\nCreateVpc';
        params.VpcId = findId(event);
        await overrideFunction('deleteVpc', params);
        results.Resource = params.VpcId;
        results.Response = 'DeleteVpc';
      break;
      case 'DeleteVpc':
        path.p += '\nDeleteVpc';
        results.Resource = erp.vpcId;
        results.Response = 'Remediation could not be performed';
      break;
      case 'AcceptVpcPeeringConnection':
        path.p += '\nAcceptVpcPeeringConnection';
        //RejectVpcPeeringConnection
        params.VpcPeeringConnectionId = findId(event);
        await overrideFunction('rejectVpcPeeringConnection', params);
        results.Resource = params.VpcPeeringConnectionId;
        results.Response = 'RejectVpcPeeringConnection';
      break;
      //DONE!
      case 'CreateVpcPeeringConnection':
        path.p += '\nCreateVpcPeeringConnection';
        //DeleteVpcPeeringConnection
        params.VpcPeeringConnectionId = findId(event);
        await overrideFunction('deleteVpcPeeringConnection', params);
        results.Resource = params.VpcPeeringConnectionId;
        results.Response = 'DeleteVpcPeeringConnection';
      break;
      case 'DeleteVpcPeeringConnection':
        path.p += '\nDeleteVpcPeeringConnection';
        results.Response = 'Remediation could not be performed';
        //notify
      break;
      case 'RejectVpcPeeringConnection':
        path.p += '\nRejectVpcPeeringConnection';
        //AcceptVpcPeeringConnection
        params.VpcPeeringConnectionId = findId(event);
        await overrideFunction('acceptVpcPeeringConnection', params);
        results.Resource = params.VpcPeeringConnectionId;
        results.Response = 'AcceptVpcPeeringConnection'
      break;
    }
  }catch(e){
    console.log(e);
    path.p += '\nERROR';
    return e;
  }
  results.Reason = 'Improper Launch';
  if(results.Response == 'Remediation could not be performed'){
    delete results.Reason;
  }
  path.p += '\nRemediation was finished, notifying user now';
  return results;
}

function findId(event){
  switch(event.detail.eventName){
    case 'AcceptVpcPeeringConnection':
    case 'DeleteVpcPeeringConnection':
    case 'RejectVpcPeeringConnection':
      return event.detail.requestParameters.vpcPeeringConnectionId;
    case 'CreateVpc':
      return event.detail.responseElements.vpc.vpcId;
    case 'CreateVpcPeeringConnection':
    case 'DeleteVpc':
    case 'ModifyVpcAttribute':
      return event.detail.requestParameters.vpcId;
  }
};

async function overrideFunction(apiFunction, params){
  if(process.env.run == 'false'){
    await setEc2Function(apiFunction, (params) => {
      console.log(`Overriding ${apiFunction}`);
      return {promise: () => {}};
    });
  }
  await ec2[apiFunction](params).promise();
};

exports.handler = handleEvent;
exports.remediate = remediate;

exports.setEc2Function = (value, funct) => {
    ec2[value] = funct;
};

exports.setRemediate = (funct) => {
    callRemediate = funct;
};