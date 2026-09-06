const httpError = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.status = statusCode;
    return error;
};
export default httpError;