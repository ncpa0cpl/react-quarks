import type { AxiosError, AxiosRequestConfig } from "axios";
import axios from "axios";
import { quark } from "../../dist";

/**
 * Generate an quark effect that will add an axios interceptor whenever 
 * the Access Token changes.
 * 
 * Interceptor will add the user Access Token to the headers of
 * every request.
 * 
 * Thanks to this interceptor we will be able to send request to the backend API 
 * without the need of providing the Access Token every time.
 */
const createOnAccessTokenChangeEffect = () => {
    // here we will store the currently added interceptor
    let currentInterceptor;

    return (previousToken: string, currentToken: string) => {
        // if the token did not change there's no need to revoke previous and add new interceptor
        if (previousToken === currentToken) return;

        // if there is a interceptor in use already, eject it, so we don't have multiple old interceptors active
        if(currentInterceptor !== undefined) {
            axios.interceptors.request.eject(currentInterceptor);
            currentInterceptor = undefined;
        }

        // add interceptor only if the token is present
        if (currentToken.length > 0) {

            // this method will inject current token into axios request config
            const modifyConfig = (config: AxiosRequestConfig) => {
                return {
                    ...config,
                    headers: {
                        ...config.headers,
                        Authorization: `Bearer: ${currentToken}`,
                    },
                };
            };

            const modifyError = (error: AxiosError) => {
                return Promise.reject(error);
            };

            // add interceptor to axios and set the currentInterceptor, so the next time this effect triggers we can eject it
            currentInterceptor = axios.interceptors.request.use(modifyConfig, modifyError);
        }
    };
};

/** Quark holding a flag indicating if the user is currently logged in. */
export const isLoggedIn = quark(false);

/** Quark holding the username of the current user. */
export const username = quark("");

/** Quark holding the refresh token. */
export const refreshToken = quark("");

/** Quark holding the current access token. */
export const accessToken = quark("", {}, {
    onAccessTokenChangeEffect: createOnAccessTokenChangeEffect()
});