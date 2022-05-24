import { requestLogin } from "./login-request-mock";
import { accessToken, isLoggedIn, refreshToken, username } from "./quarks";

/**
 * Send request to the server with the user credentials and update global state with
 * the response data.
 */
export const logIn = (loginData: { username: string; password: string }) => {
  requestLogin(loginData)
    .then((response) => {
      isLoggedIn.set(true);
      username.set(response.data.username);
      refreshToken.set(response.data.refreshToken);
      accessToken.set(response.data.accessToken);
    })
    .catch((e) => {
      // handle the log in error
    });
};

/**
 * Update the global state, set isLoggedIn flag to false and remove all information
 * about the user.
 */
export const logOut = () => {
  isLoggedIn.set(false);
  username.set("");
  refreshToken.set("");
  accessToken.set("");
};
