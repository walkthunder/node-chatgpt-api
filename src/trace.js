// TODO: List all event name
export const trace = async (evtName, params) => {
    if(process.env.DEBUG) {
        return;
    }
    return fetch(`https://www.google-analytics.com/mp/collect?api_secret=hrruIOu_Q5yOrM1__pW4dA&measurement_id=G-JETSEF2PMM`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'user-agent': 'chat-node-server'
        },
        body: JSON.stringify({
            'non_personalized_ads': true,
            events: [
                {
                    name: evtName,
                    ...(params|| {})
                }
            ]
        }),
    })
    .then(resp => {
        console.log('trace done');
        return resp;
    })
    .catch(err => {
        console.error('Trace exception caught: ', evtName, err);
    });
}