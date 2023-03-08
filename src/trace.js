// TODO: List all event name
const trace = async (evtName, params) => {
    if(process.env.DEBUG) {
        return;
    }
    return fetch(`https://www.google-analytics.com/mp/collect?api_secret=hrruIOu_Q5yOrM1__pW4dA&measurement_id=G-JETSEF2PMM`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'user-agent': navigator?.userAgent
        },
        body: JSON.stringify({
            'user_id': this.userId,
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
        const traceResp = resp.data.toString();
        traceResp && console.log('trace resp data: ', traceResp);
        return traceResp;
    })
    .catch(err => {
        console.error('Trace exception caught: ', evtName, err);
    });
}