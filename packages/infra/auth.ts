export const users = new sst.aws.CognitoUserPool("RescueHubUsers", {
  usernames: ["email"],
});

export const webAuthClient = users.addClient("RescueHubWeb");

export const mobileAuthClient = users.addClient("RescueHubMobile");
