'use strict';
const lib = require('../../lib/index.js');

module.exports.handler = async (event, context) => {

    async function assignTenantApp(tenant, appId) {
        let res = undefined;
        try {
            // assert that appId is valid
            await lib.axios.get(
                lib.orgUrl + '/api/v1/apps/' + appId,
                lib.headers
            );

            const pre = await lib.axios.get(
                lib.orgUrl + '/api/v1/groups?q=APPUSERS_' + tenant + '_' + appId,
                lib.headers
            );
            if (pre.data.length > 1) {
                throw {
                    response: {
                        status: 400,
                        data: {
                            message: 'Group search returned non unique result'
                        }
                    }
                };
            } else if (pre.data.length == 0) {
                res = await lib.axios.post(
                    lib.orgUrl + '/api/v1/groups', {
                        profile: {
                            name: 'APPUSERS_' + tenant + '_' + appId
                        }
                    },
                    lib.headers
                );
            } else {
                res = {
                    status: pre.status,
                    data: pre.data[0]
                };
            }
        } catch (e) {
            throw e;
        }

        try {
            const final = await lib.axios.put(
                lib.orgUrl + '/api/v1/apps/' + appId + '/groups/' + res.data.id, {},
                lib.headers
            );
            const tnt = await lib.getAdminsGroup(tenant, null);
            const roles = await lib.axios.get(lib.orgUrl + '/api/v1/groups/' + tnt.data.id + '/roles', lib.headers);
            const role = roles.data.filter(role => {
                return (role.type == 'USER_ADMIN');
            });
            await lib.addGroupAdminTarget(tnt.data.id, role[0].id, res.data.id);

            return {
                status: final.status,
                data: {
                    tenant: tenant,
                    appId: appId,
                    lastUpdated: res.data.lastUpdated
                }
            };
        } catch (e) {
            throw e;
        }
    }

    const response = {
        isBase64Encoded: false,
        headers: {
            "Access-Control-Allow-Origin": "*"
        }
    };
    try {
        const res = await assignTenantApp(event.pathParameters.tenant, event.pathParameters.appId);
        response.statusCode = res.status;
        response.body = JSON.stringify(res.data);
    } catch (e) {
        console.log(e);
        response.statusCode = e.response.status;
        response.body = JSON.stringify(e.response.data);
    }
    return response;
};
