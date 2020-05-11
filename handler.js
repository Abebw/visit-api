"use strict";

const uuid = require("uuid");
const AWS = require("aws-sdk");
const documentClient = new AWS.DynamoDB.DocumentClient();

function invalidInput(message) {
  return {
    statusCode: 400,
    body: JSON.stringify({
      message: message,
    }),
  };
}

function databaseRecordToClientFormat(dbRecord) {
  return {
    id: dbRecord.id,
    name: dbRecord.name,
    userId: dbRecord.userId,
  };
}

module.exports.postVisit = async (event) => {
  const requestBody = JSON.parse(event.body);
  if (false == ("name" in requestBody && "userId" in requestBody)) {
    return invalidInput("both a userId and name are required to create Visit");
  }
  const newVisitJSON = {
    id: uuid.v1(),
    name: requestBody.name,
    time: Date.now(),
    userId: requestBody.userId,
  };
  var params = {
    TableName: "Visits",
    Item: newVisitJSON,
  };
  await documentClient.put(params).promise();
  return {
    statusCode: 200,
    body: JSON.stringify({ visitId: newVisitJSON.id }),
  };
};

module.exports.getVisit = async (event) => {
  if ("visitId" in event.queryStringParameters) {
    const visitId = event.queryStringParameters.visitId;
    const params = {
      TableName: "Visits",
      Key: { id: visitId },
    };
    const dbEvent = await documentClient.get(params).promise();
    if (false == "Item" in dbEvent) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `no visitId ${visitId} found` }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(databaseRecordToClientFormat(dbEvent.Item)),
    };
  }

  if (
    "userId" in event.queryStringParameters &&
    "searchString" in event.queryStringParameters
  ) {
    const searchRegexp = new RegExp(
      event.queryStringParameters.searchString,
      "i"
    );
    const params = {
      TableName: "Visits",
      IndexName: "userId-time-index",
      KeyConditionExpression: "userId = :val",
      Limit: 5,
      ExpressionAttributeValues: {
        ":val": String(event.queryStringParameters.userId),
      },
      ScanIndexForward: false,
      Select: "ALL_ATTRIBUTES",
    };
    const dbResponse = await documentClient.query(params).promise();
    const items = dbResponse.Items.filter((item) => {
      return searchRegexp.test(item.name);
    }).map(databaseRecordToClientFormat);

    return {
      statusCode: 200,
      body: JSON.stringify(items),
    };
  }
  return invalidInput(
    "this endpoint requires either a visitID or both a userId and searchString"
  );
};
