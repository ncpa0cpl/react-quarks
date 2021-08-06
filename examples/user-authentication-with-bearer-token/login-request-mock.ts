/**
 * Mocked function for requesting a login to a website with credentials.
 * 
 * In a real app it could look something like this:
 * @example
 * axios.post("https://my-backend.api/login", {loginData});
 */
export const requestLogin = async (loginData: { username: string; password: string }) => {
    return {
        data: {
            username: loginData.username,
            accessToken: "abc",
            refreshToken: "123"
        }
    };
};