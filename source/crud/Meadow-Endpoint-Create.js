/**
* Meadow Endpoint - Create a Record
*
* @license MIT
*
* @author Steven Velozo <steven@velozo.com>
* @module Meadow
*/
/**
* Create a record using the Meadow DAL object
*/

var libAsync = require('async');

var doCreate = require('./Meadow-Operation-Create.js');

var doAPICreateEndpoint = function(pRequest, pResponse, fNext)
{
	// This state is the requirement for the UserRoleIndex value in the UserSession object... processed by default as >=
	// The default here is that any authenticated user can use this endpoint.
	pRequest.EndpointAuthorizationRequirement = pRequest.EndpointAuthorizationLevels.Create;
	
	if (pRequest.CommonServices.authorizeEndpoint(pRequest, pResponse, fNext) === false)
	{
		// If this endpoint fails, it's sent an error automatically.
		return;
	}
	
	// Configure the request for the generic create operation
	pRequest.CreatedRecords = [];
	pRequest.MeadowOperation = 'Create';

	libAsync.waterfall(
		[
			function(fStageComplete)
			{
				//1. Validate request body to ensure it is a valid record
				if (typeof(pRequest.body) !== 'object')
				{
					return pRequest.CommonServices.sendError('Record create failure - a valid record is required.', pRequest, pResponse, fNext);
				}

				return fStageComplete();
			},
			function(fStageComplete)
			{
				pRequest.Response = pResponse;
				pRequest.BehaviorModifications.runBehavior('Create-PreRequest', pRequest, fStageComplete);
			},
			function(fStageComplete)
			{
				//4. Do the create operation
				doCreate(pRequest.body, pRequest, pResponse, fStageComplete);
			},
			function(fStageComplete)
			{
				//5. Respond with the new record

				// If there was an error, respond with that instead
				if (pRequest.RecordCreateError)
					return fStageComplete(pRequest.RecordCreateErrorMessage);

				pResponse.send(pRequest.Record);
				return fStageComplete();
			}
		], function(pError)
		{
			if (pError && pError!='ABORT') //TODO: should have an abort token/const
			{
				return pRequest.CommonServices.sendCodedError('Error creating a record.', pError, pRequest, pResponse, fNext);
			}

			return fNext();
		});
};

module.exports = doAPICreateEndpoint;