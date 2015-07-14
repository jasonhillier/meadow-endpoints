/**
* Meadow Endpoint - Delete a Record
*
* @license MIT
*
* @author Steven Velozo <steven@velozo.com>
* @module Meadow
*/
/**
* Delete a record using the Meadow DAL object
*/
var doAPIDeleteEndpoint = function(pRequest, pResponse, fNext)
{
	// This state is the requirement for the UserRoleIndex value in the SessionData object... processed by default as >=
	// The default here is that any authenticated user can use this endpoint.
	pRequest.EndpointAuthorizationRequirement = pRequest.EndpointAuthorizationLevels.Delete;
	
	// INJECT: Pre authorization (for instance to change the authorization level)
	
	// OVERLOAD: Endpoint authorization (for instance if it is a complex authorization requirement)
	if (pRequest.CommonServices.authorizeEndpoint(pRequest, pResponse, fNext) === false)
	{
		// If this endpoint fails, it's sent an error automatically.
		return;
	}

	// INJECT: Pre endpoint operation

	// OVERLOAD: Body validation and parsing
	var tmpIDRecord = 0;
	if (typeof(pRequest.params.IDRecord) === 'string')
	{
		tmpIDRecord = pRequest.params.IDRecord;
	}
	else if (typeof(pRequest.body[pRequest.DAL.defaultIdentifier]) === 'number')
	{
		tmpIDRecord = pRequest.body[pRequest.DAL.defaultIdentifier];
	}
	else if (typeof(pRequest.body[pRequest.DAL.defaultIdentifier]) === 'string')
	{
		tmpIDRecord = pRequest.body[pRequest.DAL.defaultIdentifier];
	}
	// Although the delete request does allow multiple deletes, we require an identifier.
	if (tmpIDRecord < 1)
	{
		return pRequest.CommonServices.sendError('Record delete failure - a valid record ID is required in the passed-in record.', pRequest, pResponse, fNext);
	}

	// INJECT: Record modification before update

	// OVERLOAD: Query instantiation
	var tmpQuery = pRequest.DAL.query;

	// INJECT: Query configuration and population

	// This is not overloadable.`
	tmpQuery.addFilter(pRequest.DAL.defaultIdentifier, tmpIDRecord);

	// Do the delete
	pRequest.DAL.doDelete(tmpQuery,
		function(pError, pQuery, pCount)
		{
			// It returns the number of rows deleted
			var tmpRecordCount = {Count:pCount};

			// INJECT: After the delete count is grabbed, let the user alter the response content

			pRequest.CommonServices.log.info('Deleted '+pCount+' records with ID '+tmpIDRecord+'.', {SessionID:pRequest.SessionData.SessionID, RequestID:pRequest.RequestUUID, RequestURL:pRequest.url, Action:pRequest.DAL.scope+'-Delete'});
			pResponse.send(tmpRecordCount);
			return fNext();
		}
	);
};

module.exports = doAPIDeleteEndpoint;