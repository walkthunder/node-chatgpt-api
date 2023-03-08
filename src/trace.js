// TODO: List all event name
// eslint-disable-next-line import/prefer-default-export
export const trace = async (evtName, params) => {
    if (process.env.DEBUG) {
        return;
    }
    // eslint-disable-next-line consistent-return
    return fetch('https://www.google-analytics.com/mp/collect?api_secret=hrruIOu_Q5yOrM1__pW4dA&measurement_id=G-JETSEF2PMM', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'user-agent': 'chat-node-server',
        },
        body: JSON.stringify({
            non_personalized_ads: true,
            events: [
                {
                    name: evtName,
                    ...(params || {}),
                },
            ],
        }),
    })
        .then(resp => resp.json())
        .then((resp) => {
            console.log('trace done', resp);
            return resp;
        })
        .catch((err) => {
            console.error('Trace exception caught: ', evtName, err);
        });
};
