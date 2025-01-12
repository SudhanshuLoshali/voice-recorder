exports.handler = async (event) => {
    try {
        console.log('Event:', JSON.stringify(event));
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully retrieved audio',
                event: event
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error getting audio',
                error: error.message
            })
        };
    }
};