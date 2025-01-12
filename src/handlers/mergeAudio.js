exports.handler = async (event) => {
    try {
        console.log('Event:', JSON.stringify(event));
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully merged audio',
                event: event
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error merging audio',
                error: error.message
            })
        };
    }
};