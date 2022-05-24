import axios from "axios";
import { isLoggedIn, username } from "./quarks";

export const App: React.FC = () => {
  const isLogged = isLoggedIn.use();
  const user = username.use();

  /**
   * This method will send a request to the server only if you are logged in, since
   * the Quark that hold the Access Token has an effect that sets the axios
   * interceptors to include the Bearer token in every request automatically, this
   * ensures that this POST request will always be seen as authenticated with the
   * current user. No need to include the token on every request.
   */
  const postSomethingToTheBackendAPI = () => {
    if (isLogged.value) {
      const someData = {};
      axios.post("https://my-backend.api/something", someData);
    }
  };

  return (
    <div>
      {isLogged.value ? (
        <h1>Hello {user.value}</h1>
      ) : (
        <h1>You are not logged in!</h1>
      )}
      <br />
      <button onClick={postSomethingToTheBackendAPI}>Send request to API</button>
    </div>
  );
};
