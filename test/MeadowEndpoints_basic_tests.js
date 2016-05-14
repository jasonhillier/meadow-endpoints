/**
* Unit tests for the MeadowEndpoints Server
*
* @license     MIT
*
* @author      Steven Velozo <steven@velozo.com>
*/

var Chai = require("chai");
var Expect = Chai.expect;
var Assert = Chai.assert;

var libSuperTest = require('supertest');

var libMySQL = require('mysql2');
var libAsync = require('async');

var tmpFableSettings = 	(
{
	Product: 'MockOratorAlternate',
	ProductVersion: '0.0.0',

	APIServerPort: 9080,

	MySQL:
		{
			// This is queued up for Travis defaults.
			Server: "localhost",
			Port: 3306,
			User: "root",
			Password: "",
			Database: "FableTest",
			ConnectionPoolLimit: 20
		},
	ConfigFile: __dirname + "/../MeadowTest-Settings.json"
});

var libFable = require('fable').new(tmpFableSettings);
tmpFableSettings = libFable.settings;

var _MockSessionValidUser = (
	{
		SessionID: '0000-VALID',
		UserID: 37,
		UserRole: 'User',
		UserRoleIndex: 1,
		LoggedIn: true,
		DeviceID: 'TEST-HARNESS'
	});
var ValidAuthentication = function(pRequest, pResponse, fNext)
{
	pRequest.SessionData = _MockSessionValidUser;
	fNext();
}

var _Meadow;
var _MeadowEndpoints;

var _AnimalSchema = require('./Animal.json');

// Now that we have some test data, wire up the endpoints!

// Load up a Meadow (pointing at the Animal database)
_Meadow = require('meadow')
				.new(libFable, 'FableTest')
				.setProvider('MySQL')
				.setSchema(_AnimalSchema.Schema)
				.setJsonSchema(_AnimalSchema.JsonSchema)
				.setDefaultIdentifier(_AnimalSchema.DefaultIdentifier)
				.setDefault(_AnimalSchema.DefaultObject)
				.setAuthorizer(_AnimalSchema.Authorization);
// Instantiate the endpoints
_MeadowEndpoints = require('../source/Meadow-Endpoints.js').new(_Meadow);

suite
(
	'Meadow-Endpoints',
	function()
	{
		// TODO: Abstract this so it can be run again and again.
		var _SpooledUp = false;
		var _Orator;

		var getAnimalInsert = function(pName, pType)
		{
			return "INSERT INTO `FableTest` (`IDAnimal`, `GUIDAnimal`, `CreateDate`, `CreatingIDUser`, `UpdateDate`, `UpdatingIDUser`, `Deleted`, `DeleteDate`, `DeletingIDUser`, `Name`, `Type`) VALUES (NULL, '00000000-0000-0000-0000-000000000000', NOW(), 1, NOW(), 1, 0, NULL, 0, '"+pName+"', '"+pType+"'); ";
		};

		setup
		(
			function(fDone)
			{
				// Only do this for the first test, so we persiste database state across suites
				if (!_SpooledUp)
				{
					_Orator = require('orator').new(tmpFableSettings);
					_Orator.enabledModules.CORS = true;
					_Orator.enabledModules.FullResponse = true;
					_Orator.enabledModules.Body = false;


					var _SQLConnectionPool = libMySQL.createPool
					(
						{
							connectionLimit: tmpFableSettings.MySQL.ConnectionPoolLimit,
							host: tmpFableSettings.MySQL.Server,
							port: tmpFableSettings.MySQL.Port,
							user: tmpFableSettings.MySQL.User,
							password: tmpFableSettings.MySQL.Password,
							database: tmpFableSettings.MySQL.Database
						}
					);

					// Tear down previous test data, rebuild records
					libAsync.waterfall(
					[
						function(fCallBack)
						{
							_SQLConnectionPool.query('DROP TABLE IF EXISTS FableTest',
							function(pErrorUpdate, pResponse) { fCallBack(null); });
						},
						function(fCallBack)
						{
							_SQLConnectionPool.query("CREATE TABLE IF NOT EXISTS FableTest (IDAnimal INT UNSIGNED NOT NULL AUTO_INCREMENT, GUIDAnimal CHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000', CreateDate DATETIME, CreatingIDUser INT NOT NULL DEFAULT '0', UpdateDate DATETIME, UpdatingIDUser INT NOT NULL DEFAULT '0', Deleted TINYINT NOT NULL DEFAULT '0', DeleteDate DATETIME, DeletingIDUser INT NOT NULL DEFAULT '0', Name CHAR(128) NOT NULL DEFAULT '', Type CHAR(128) NOT NULL DEFAULT '', PRIMARY KEY (IDAnimal) );",
							function(pErrorUpdate, pResponse) { fCallBack(null); });
						},
						function(fCallBack)
						{
							_SQLConnectionPool.query(getAnimalInsert('Foo Foo', 'Bunny'),
							function(pErrorUpdate, pResponse) { fCallBack(null); });
						},
						function(fCallBack)
						{
							_SQLConnectionPool.query(getAnimalInsert('Red Riding Hood', 'Girl'),
							function(pErrorUpdate, pResponse) { fCallBack(null); });
						},
						function(fCallBack)
						{
							_SQLConnectionPool.query(getAnimalInsert('Red', 'Dog'),
							function(pErrorUpdate, pResponse) { fCallBack(null); });
						},
						function(fCallBack)
						{
							_SQLConnectionPool.query(getAnimalInsert('Spot', 'Dog'),
							function(pErrorUpdate, pResponse) { fCallBack(null); });
						},
						function(fCallBack)
						{
							_SQLConnectionPool.query(getAnimalInsert('Gertrude', 'Frog'),
							function(pErrorUpdate, pResponse) { fCallBack(null); });
						},
						function(fCallBack)
						{
							// Start the web server
							// Wire up an "always logged in" user in the request chain, so session is set right.
							_Orator.webServer.use(ValidAuthentication);
							_MeadowEndpoints.setEndpointAuthorization
							(
								'Create',
								2
							);
							_MeadowEndpoints.setEndpointAuthenticator ('Reads');
							_MeadowEndpoints.setEndpointAuthenticator
							(
								'Reads',
								function(pRequest, pResponse, fNext)
								{
									pRequest.EndpointAuthenticated = true;
									fNext();
								}
							);
							_MeadowEndpoints.setEndpoint('Randomize');
							_MeadowEndpoints.setEndpoint('Randomize', function() {});

							_MeadowEndpoints.behaviorModifications.setTemplate('ListQuery', '<%= MyData %>');

							// Wire the endpoints up
							_MeadowEndpoints.connectRoutes(_Orator.webServer);
							_Orator.startWebServer (function() { fCallBack(null); });
						}
					],
						function(pError, pResult)
						{
							// Now continue the tests.
							_SpooledUp = true;
							fDone();
						}
					);
				}
				else
				{
					fDone();
				}
			}
		);

		setup
		(
			function()
			{
			}
		);

		suite
		(
			'Object Sanity',
			function()
			{
				test
				(
					'initialize should build a happy little object',
					function()
					{
						Expect(_MeadowEndpoints).to.be.an('object', 'MeadowEndpoints should initialize as an object directly from the require statement.');
					}
				);
			}
		);
		suite
		(
			'Behavior Modifications',
			function()
			{
				test
				(
					'instantiate a behavior modification object',
					function()
					{
						var tmpBehaviorMods = require('../source/Meadow-BehaviorModifications.js').new(libFable);
						Expect(tmpBehaviorMods).to.be.an('object');
					}
				);
				test
				(
					'exercise the templates api',
					function()
					{
						var tmpBehaviorMods = require('../source/Meadow-BehaviorModifications.js').new(libFable);

						var tmpCrossBehaviorState = 0;

						Expect(tmpBehaviorMods.runBehavior('NoBehaviorsHere', {}, function() {})).to.equal(undefined, 'nonexistant behaviors should just execute');
						tmpBehaviorMods.setBehavior('BigBehavior', function() { tmpCrossBehaviorState++ });
						Expect(tmpCrossBehaviorState).to.equal(0);
						Expect(tmpBehaviorMods.runBehavior('BigBehavior', {}, function() {})).to.equal(undefined, 'existant behaviors should just execute');
						Expect(tmpCrossBehaviorState).to.equal(1);
					}
				);
				test
				(
					'exercise the behavior modification api',
					function()
					{
						var tmpBehaviorMods = require('../source/Meadow-BehaviorModifications.js').new(libFable);
						Expect(tmpBehaviorMods.getTemplateFunction('NoTemplatesHere')).to.equal(false, 'empty template hashes on empty sets should return false');
						Expect(tmpBehaviorMods.getTemplate('NoTemplatesHere')).to.equal(false,'emtpy template sets should be false');
						tmpBehaviorMods.setTemplate('AnimalFormatter', '<p>An animal (id <%= Number %> is here</p>');
						Expect(tmpBehaviorMods.getTemplate('AnimalFormatter')).to.contain('An animal');
						Expect(tmpBehaviorMods.processTemplate('AnimalFormatter', {Number:5})).to.contain('id 5');
						Expect(tmpBehaviorMods.processTemplate('FriendFormatter', {Number:5}, 'blit <%= Number %>')).to.contain('blit 5');
						Expect(tmpBehaviorMods.processTemplate('Blank', {Number:5})).to.equal('');
						tmpBehaviorMods.setTemplate('SimpleTemplate', 'Not so simple.');
						Expect(tmpBehaviorMods.processTemplate('SimpleTemplate')).to.equal('Not so simple.');
					}
				);
				test
				(
					'exercise the security modification api',
					function()
					{
						var tmpAuthorizers = require('../source/Meadow-Authorizers.js').new(libFable);
						tmpAuthorizers.setAuthorizer('AlwaysAuthorize', 
							function(pRequest, fComplete)
							{
								pRequest.MeadowAuthorization = true;
							});
						var tmpMockRequest = {MeadowAuthorization: 'Green'};
						tmpAuthorizers.authorize('BadHash', tmpMockRequest,
							function()
							{
								Expect(tmpMockRequest.MeadowAuthorization).to.equal('Green');
							});
						tmpAuthorizers.authorize('AlwaysAuthorize', tmpMockRequest,
							function()
							{
								Expect(tmpMockRequest.MeadowAuthorization).to.equal(true);
							});
						tmpAuthorizers.authorize('Allow', tmpMockRequest,
							function()
							{
								Expect(tmpMockRequest.MeadowAuthorization).to.equal(true);
							});
						tmpAuthorizers.authorize('Deny', tmpMockRequest,
							function()
							{
								Expect(tmpMockRequest.MeadowAuthorization).to.equal(false);
							});
						var tmpMockFullRequest = 
						{
							SessionData:
							{
								CustomerID: 10,
								UserID: 1
							},
							Record:
							{
								IDCustomer: 10,
								IDUser: 1
							}
						};
						// Test that 
					}
				);
				test
				(
					'exercise the security modification authenticators',
					function()
					{
						var tmpAuthorizers = require('../source/Meadow-Authorizers.js').new(libFable);
						var tmpMockFullRequest = 
						{
							SessionData:
							{
								CustomerID: 10,
								UserID: 1
							},
							Record:
							{
								IDCustomer: 10,
								CreatingIDUser: 1
							}
						};
						// Mine and MyCustomer should both work
						tmpAuthorizers.authorize('Mine', tmpMockFullRequest,
							function()
							{
								Expect(tmpMockFullRequest.MeadowAuthorization).to.equal(true);
							});
						tmpAuthorizers.authorize('MyCustomer', tmpMockFullRequest,
							function()
							{
								Expect(tmpMockFullRequest.MeadowAuthorization).to.equal(true);
							});
						tmpMockFullRequest.SessionData.CustomerID = 100;
						tmpMockFullRequest.SessionData.UserID = 100;
						// Now they should both fail
						tmpAuthorizers.authorize('Mine', tmpMockFullRequest,
							function()
							{
								//If record does not have matching CreatingIDUser, then it should fail
								Expect(tmpMockFullRequest.MeadowAuthorization).to.equal(false);
							});
						tmpAuthorizers.authorize('MyCustomer', tmpMockFullRequest,
							function()
							{
								//If record does not have matching CustomerID, then it should fail
								Expect(tmpMockFullRequest.MeadowAuthorization).to.equal(false);
							});
					}
				);
			}
		);
		suite
		(
			'Basic Server Routes',
			function()
			{
				test
				(
					'create: create a record',
					function(fDone)
					{
						var tmpRecord = {Name:'BatBrains', Type:'Mammoth'};
						_MockSessionValidUser.UserRoleIndex = 2;
						libSuperTest('http://localhost:9080/')
						.post('1.0/FableTest')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Type).to.equal('Mammoth');
								Expect(tmpResult.CreatingIDUser).to.equal(37);
								fDone();
							}
						);
					}
				);
				test
				(
					'create: create a record',
					function(fDone)
					{
						var tmpRecord = {Name:'BatBrains', Type:'Mammoth'};
						_MockSessionValidUser.UserRoleIndex = 1;
						libSuperTest('http://localhost:9080/')
						.post('1.0/FableTest')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('authenticated');
								fDone();
							}
						);
					}
				);
				test
				(
					'create: create a record with a bad record passed in',
					function(fDone)
					{
						var tmpRecord = ' ';
						_MockSessionValidUser.UserRoleIndex = 2;
						libSuperTest('http://localhost:9080/')
						.post('1.0/FableTest')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('a valid record is required');
								fDone();
							}
						);
					}
				);
				test
				(
					'read: get a specific record',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/2')
						.end(
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Type).to.equal('Girl');
								fDone();
							}
						);
					}
				);
				test
				(
					'read: define a custom route and get a record with it',
					function(fDone)
					{
						_Orator.webServer.get('/CustomHotRodRoute/:IDRecord', _MeadowEndpoints.endpointAuthenticators.Read, _MeadowEndpoints.wireState, _MeadowEndpoints.endpoints.Read)
						libSuperTest('http://localhost:9080/')
						.get('CustomHotRodRoute/2')
						.end(
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Type).to.equal('Girl');
								fDone();
							}
						);
					}
				);
				test
				(
					'read: get a specific record but be denied by security',
					function(fDone)
					{
						_Meadow.schemaFull.authorizer.Manager = {};
						_Meadow.schemaFull.authorizer.Manager.Read = 'Deny';

						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/2')
						.end(
							function (pError, pResponse)
							{					
								Expect(pResponse.text).to.contain('UNAUTHORIZED ACCESS IS NOT ALLOWED');
								// Reset authorization
								_Meadow.schemaFull.authorizer.Manager.Read = 'Allow';
								fDone();
							}
						);
					}
				);
				test
				(
					'read: get a specific record with a bad parameter',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/')
						.end(
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.equal('Error retreiving a record. Record not found');
								fDone();
							}
						);
					}
				);
				test
				(
					'reads: get all records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTests')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(6);
								Expect(tmpResults[0].Type).to.equal('Bunny');
								Expect(tmpResults[4].Name).to.equal('Gertrude');
								fDone();
							}
						);
					}
				);
				test
				(
					'readsby: get all records by Type',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTests/By/Type/Dog')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(2);
								Expect(tmpResults[0].Type).to.equal('Dog');
								fDone();
							}
						);
					}
				);
				test
				(
					'readsby: get all records by Type IN LIST',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTests/By/Type/Mammoth%2C%20WithComma,Dog')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(2);
								Expect(tmpResults[0].Type).to.equal('Dog');
								fDone();
							}
						);
					}
				);
				test
				(
					'countby: get count of records by Type',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTests/Count/By/Type/Dog')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.Count).to.equal(2);
								fDone();
							}
						);
					}
				);
				test
				(
					'countby: get count of records by multiple Types',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTests/Count/By/Type/Dog,Mammoth')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.Count).to.equal(3);
								fDone();
							}
						);
					}
				);
				test
				(
					'readsby: get paged records by Type',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTests/By/Type/Dog/1/1')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(1);
								Expect(tmpResults[0].Name).to.equal('Spot');
								fDone();
							}
						);
					}
				);
				test
				(
					'readselect: get all records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTestSelect')
						.end(
							function (pError, pResponse)
							{
								console.log(pResponse.text)
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(6);
								Expect(tmpResults[4].Value).to.equal('FableTest #5');
								fDone();
							}
						);
					}
				);
				test
				(
					'readselect: get a page of records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTestSelect/2/2')
						.end(
							function (pError, pResponse)
							{
								console.log(pResponse.text)
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(2);
								Expect(tmpResults[1].Value).to.equal('FableTest #4');
								fDone();
							}
						);
					}
				);
				test
				(
					'readselect: get a page of records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTestSelect/2/2')
						.end(
							function (pError, pResponse)
							{
								console.log(pResponse.text)
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(2);
								Expect(tmpResults[1].Value).to.equal('FableTest #4');
								fDone();
							}
						);
					}
				);
				test
				(
					'readselect: get filtered records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTestSelect/FilteredTo/FBV~Type~EQ~Dog')
						.end(
							function (pError, pResponse)
							{
								console.log('FUCK'+pResponse.text)
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(6);
								Expect(tmpResults[0].Value).to.equal('FableTest #1');
								fDone();
							}
						);
					}
				);
				test
				(
					'readselect: get a page of filtered records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTestSelect/FilteredTo/FBV~Type~EQ~Dog/1/1')
						.end(
							function (pError, pResponse)
							{
								console.log(pResponse.text)
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(1);
								Expect(tmpResults[0].Value).to.equal('FableTest #4');
								fDone();
							}
						);
					}
				);
				test
				(
					'readselect: get an empty page of records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTestSelect/200/200')
						.end(
							function (pError, pResponse)
							{
								console.log(pResponse.text)
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(0);
								fDone();
							}
						);
					}
				);
				test
				(
					'reads: get a page of records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						// Get page 2, 2 records per page.
						.get('1.0/FableTests/2/2')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(2);
								Expect(tmpResults[0].Type).to.equal('Dog');
								Expect(tmpResults[1].Name).to.equal('Spot');
								fDone();
							}
						);
					}
				);
				test
				(
					'reads: get a filtered set of records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						// Get page 2, 2 records per page.
						.get('1.0/FableTests/FilteredTo/FBV~Type~EQ~Frog')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(1);
								Expect(tmpResults[0].Type).to.equal('Frog');
								fDone();
							}
						);
					}
				);				test
				(
					'reads: get a filtered paged set of records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						// Get page 2, 2 records per page.
						.get('1.0/FableTests/FilteredTo/FBV~Type~EQ~Dog/1/2')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(1);
								Expect(tmpResults[0].Type).to.equal('Dog');
								fDone();
							}
						);
					}
				);
				test
				(
					'update: update a record',
					function(fDone)
					{
						// Change animal 4 ("Spot") to a Corgi
						var tmpRecord = {IDAnimal:4, Type:'Corgi'};
						libSuperTest('http://localhost:9080/')
						.put('1.0/FableTest')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Type).to.equal('Corgi');
								Expect(tmpResult.CreatingIDUser).to.equal(1);
								Expect(tmpResult.UpdatingIDUser).to.equal(37);
								fDone();
							}
						);
					}
				);
				test
				(
					'delete: delete a record',
					function(fDone)
					{
						// Delete animal 3 ("Red")
						var tmpRecord = {IDAnimal:3};
						libSuperTest('http://localhost:9080/')
						.del('1.0/FableTest')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the count of deleted records.
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Count).to.equal(1);
								fDone();
							}
						);
					}
				);
				test
				(
					'delete: delete a record with a bad parameter',
					function(fDone)
					{
						// Delete animal 3 ("Red")
						var tmpRecord = {IDAnimal:{MyStuff:4}};
						libSuperTest('http://localhost:9080/')
						.del('1.0/FableTest')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the count of deleted records.
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('a valid record ID is required');
								fDone();
							}
						);
					}
				);
				test
				(
					'count: get the count of records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTests/Count')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.Count).to.equal(5);
								fDone();
							}
						);
					}
				);
				test
				(
					'count: get the count of filtered records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTests/Count/FilteredTo/FBV~Type~EQ~Girl')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.Count).to.equal(1);
								fDone();
							}
						);
					}
				);
				test
				(
					'schema: get the schema of a record',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/Schema')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								//console.log('SCHEMA --> '+JSON.stringify(tmpResults, null, 4))
								Expect(tmpResults.title).to.equal('Animal');
								Expect(tmpResults.description).to.contain('creature that lives in');
								fDone();
							}
						);
					}
				);
				test
				(
					'new: get a new empty record',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/Schema/New')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResults, null, 4))
								Expect(tmpResults.IDAnimal).to.equal(null);
								Expect(tmpResults.Name).to.equal('Unknown');
								Expect(tmpResults.Type).to.equal('Unclassified');
								fDone();
							}
						);
					}
				);
				test
				(
					'validate: validate an invalid record',
					function(fDone)
					{
						var tmpRecord = {IDAnimal:4, Type:'Corgi'};
						libSuperTest('http://localhost:9080/')
						.post('1.0/FableTest/Schema/Validate')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResult, null, 4))
								Expect(tmpResult.Valid).to.equal(false);
								Expect(tmpResult.Errors[0].field).to.equal('data.Name');
								Expect(tmpResult.Errors[0].message).to.equal('is required');
								fDone();
							}
						);
					}
				);
				test
				(
					'validate: validate a valid record',
					function(fDone)
					{
						var tmpRecord = {IDAnimal:4, Type:'Corgi', Name:'Doofer', CreatingIDUser:10};
						libSuperTest('http://localhost:9080/')
						.post('1.0/FableTest/Schema/Validate')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResult, null, 4))
								Expect(tmpResult.Valid).to.equal(true);
								fDone();
							}
						);
					}
				);
				test
				(
					'validate: validate bad data',
					function(fDone)
					{
						var tmpRecord = 'IAMBAD';
						libSuperTest('http://localhost:9080/')
						.post('1.0/FableTest/Schema/Validate')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResult, null, 4))
								Expect(tmpResult.Error).to.contain('validate failure');
								fDone();
							}
						);
					}
				);
			}
		);
		suite
		(
			'Unauthorized server routes',
			function()
			{
				test
				(
					'read: get a specific record',
					function(fDone)
					{
						_MockSessionValidUser.UserRoleIndex = 0;
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/2')
						.end(
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('You must be appropriately authenticated');
								_MockSessionValidUser.UserRoleIndex = 1;
								fDone();
							}
						);
					}
				);
			}
		);
		suite
		(
			'Bad user server routes',
			function()
			{
				test
				(
					'create: create a record',
					function(fDone)
					{
						_MockSessionValidUser.UserID = 0;
						var tmpRecord = {Name:'BatBrains', Type:'Mammoth'};
						libSuperTest('http://localhost:9080/')
						.post('1.0/FableTest')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('authenticated');
								fDone();
							}
						);
					}
				);
				test
				(
					'read: get a specific record',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/2')
						.end(
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('authenticated');
								fDone();
							}
						);
					}
				);
				test
				(
					'readselect: get all records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTestSelect')
						.end(
							function (pError, pResponse)
							{
								console.log(pResponse.text)
								var tmpResults = JSON.parse(pResponse.text);
								Expect(tmpResults.Error).to.contain('authenticated');
								fDone();
							}
						);
					}
				);
				test
				(
					'update: update a record',
					function(fDone)
					{
						// Change animal 4 ("Spot") to a Corgi
						var tmpRecord = {IDAnimal:4, Type:'Corgi'};
						libSuperTest('http://localhost:9080/')
						.put('1.0/FableTest')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('authenticated');
								fDone();
							}
						);
					}
				);
				test
				(
					'schema: get the schema of a record',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/Schema')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								//console.log('SCHEMA --> '+JSON.stringify(tmpResults, null, 4))
								Expect(tmpResults.Error).to.contain('authenticated');
								fDone();
							}
						);
					}
				);
				test
				(
					'new: get a new empty record',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/Schema/New')
						.end(
							function (pError, pResponse)
							{
								var tmpResults = JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResults, null, 4))
								Expect(tmpResults.Error).to.contain('authenticated');
								fDone();
							}
						);
					}
				);
				test
				(
					'validate: validate an invalid record',
					function(fDone)
					{
						var tmpRecord = {IDAnimal:4, Type:'Corgi'};
						libSuperTest('http://localhost:9080/')
						.post('1.0/FableTest/Schema/Validate')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResult, null, 4))
								Expect(tmpResult.Error).to.contain('authenticated');
								fDone();

							}
						);
					}
				);
				test
				(
					'count: get the count of records',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTests/Count')
						.end(
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('authenticated');
								fDone();
							}
						);
					}
				);
				test
				(
					'delete: delete a record',
					function(fDone)
					{
						// Delete animal 3 ("Red")
						var tmpRecord = {IDAnimal:3};
						libSuperTest('http://localhost:9080/')
						.del('1.0/FableTest')
						.send(tmpRecord)
						.end(
							function(pError, pResponse)
							{
								// Expect response to be the count of deleted records.
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('authenticated');
								_MockSessionValidUser.UserID = 10;
								fDone();
							}
						);
					}
				);
			}
		);
		suite
		(
			'Not logged in server routes',
			function()
			{
				test
				(
					'read: get a specific record',
					function(fDone)
					{
						_MockSessionValidUser.LoggedIn = false;
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/2')
						.end(
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('You must be authenticated');
								_MockSessionValidUser.LoggedIn = true;
								fDone();
							}
						);
					}
				);
			}
		);
		suite
		(
			'Filter parser',
			function()
			{
				test
				(
					'Filter parse',
					function(fDone)
					{
						var tmpQuery = _MeadowEndpoints.DAL.query;
						_MeadowEndpoints.parseFilter('FBV~UUIDAnimal~EQ~1000000', tmpQuery);
						Expect(tmpQuery.parameters.filter[0].Column).to.equal('UUIDAnimal');
						fDone();
					}
				);
			}
		);
		suite
		(
			'Changing route requirement',
			function()
			{
				test
				(
					'read: get a specific record',
					function(fDone)
					{
						Expect(_MeadowEndpoints.endpointAuthorizationLevels.Read).to.equal(1);
						fDone();
					}
				);
			}
		);
		suite
		(
			'Behavior modifications',
			function()
			{
				test
				(
					'read: modified get of a specific record',
					function(fDone)
					{
						// Override the query configuration
						_MeadowEndpoints.behaviorModifications.setBehavior('Read-QueryConfiguration', [
							function(pRequest, fComplete)
							{
								//implicitly test behvaior-cascade
								return fComplete(false);
							},
							function(pRequest, fComplete)
							{
								// Turn up logging on the request.
								pRequest.Query.setLogLevel(5);
								fComplete(false);
							} ]);
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/2')
						.end(
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResult, null, 4))
								Expect(tmpResult.Name).to.equal('Red Riding Hood');
								fDone();
							}
						);
					}
				);
				test
				(
					'read: inject data into the record',
					function(fDone)
					{
						// Override the query configuration
						_MeadowEndpoints.behaviorModifications.setBehavior('Read-PostOperation',
							function(pRequest, fComplete)
							{
								// Create a custom property on the record.
								pRequest.Record.CustomProperty = 'Custom '+pRequest.Record.Type+' ID '+pRequest.Record.IDAnimal;
								fComplete(false);
							});
						_MockSessionValidUser.LoggedIn = true;
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/2')
						.end(
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResult, null, 4))
								Expect(tmpResult.CustomProperty).to.equal('Custom Girl ID 2');
								fDone();
							}
						);
					}
				);
				test
				(
					'read-max: get the max record ID',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/Max/IDAnimal')
						.end(
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.IDAnimal).to.equal(6);
								fDone();
							}
						);
					}
				);
				test
				(
					'read-max: get the max name',
					function(fDone)
					{
						libSuperTest('http://localhost:9080/')
						.get('1.0/FableTest/Max/Name')
						.end(
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Name).to.equal('Spot');
								fDone();
							}
						);
					}
				);
			}
		);
		suite
		(
			'Direct invocation',
			function()
			{
				var tmpCreatedRecordGUID;

				test
				(
					'invoke create: create a record',
					function(fDone)
					{
						var tmpRecord = {Name:'BatBrains', Type:'Mammoth'};
						_MockSessionValidUser.UserRoleIndex = 1;
						_MeadowEndpoints.invokeEndpoint('Create', tmpRecord,
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								Expect(pResponse.body.Name)
									.to.equal(tmpRecord.Name);

								tmpCreatedRecordGUID = pResponse.body.GUIDAnimal;

								fDone();
							}
						);
					}
				);
				test
				(
					'invoke create: create a record with a bad record passed in',
					function(fDone)
					{
						var tmpRecord = ' ';
						_MockSessionValidUser.UserRoleIndex = 2;
						_MeadowEndpoints.invokeEndpoint('Create', tmpRecord,
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('a valid record is required');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke read: get a specific record',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('Read', {IDRecord: 2}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Type).to.equal('Girl');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke read: get a specific record by GUID',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('Read', {GUIDRecord: tmpCreatedRecordGUID}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Type).to.equal('Mammoth');
								fDone();
							}
						);
					}
				);
				test
				(
					'read: get a specific record with a bad parameter',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('Read', {},
							function (pError, pResponse)
							{
								var tmpResult = JSON.parse(pResponse.text);
								//console.log(tmpResult);
								Expect(tmpResult.Error).to.be.an('undefined'); //
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke readselect: get all records',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('ReadSelectList', {}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								console.log(pResponse.body)
								Expect(pResponse.body)
									.to.be.an('array');
								//var tmpResults = JSON.parse(pResponse.text);
								//Expect(tmpResults.Error).to.contain('authenticated');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke readsby: get all records by Type',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('ReadsBy', {ByField: 'Type', ByValue: 'Mammoth'}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								//console.log(pResponse.body);

								var tmpResults = pResponse.body; //JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(2);
								Expect(tmpResults[0].Type).to.equal('Mammoth');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke readsby: get all records by Type IN LIST',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('ReadsBy', {ByField: 'Type', ByValue: ['Mammoth', 'Dog']}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								//console.log(pResponse.body);

								var tmpResults = pResponse.body; //JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(2);
								Expect(tmpResults[0].Type).to.equal('Mammoth');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke countby: get cout of records by Type',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('CountBy', {ByField: 'Type', ByValue: 'Mammoth'}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								var tmpResults = pResponse.body; //JSON.parse(pResponse.text);
								Expect(tmpResults.Count).to.equal(2);
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke readsby: get paged records by Type',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('ReadsBy', {ByField: 'Type', ByValue: 'Mammoth', Begin: 1, Cap: 1}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								var tmpResults = pResponse.body;
								Expect(tmpResults.length).to.equal(1);
								Expect(tmpResults[0].Type).to.equal('Mammoth');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke readselect: get a page of records',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('ReadSelectList', {Begin: 2, Cap: 2}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								var tmpResults = pResponse.Records; //JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(2);
								Expect(tmpResults[1].Value).to.equal('FableTest #5');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke readselect: get an empty page of records',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('ReadSelectList', {Begin: 200, Cap: 200}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								var tmpResults = pResponse.Records; //JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(0);
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke reads: get a page of records',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('Reads', {Begin: 2, Cap: 2}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								var tmpResults = pResponse.Records; //JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(2);
								Expect(tmpResults[0].Type).to.equal('Corgi');
								Expect(tmpResults[1].Name).to.equal('Gertrude');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke update: update a record',
					function(fDone)
					{
						// Change animal 4 ("Spot") to a Corgi
						var tmpRecord = {IDAnimal:4, Type:'Corgi'};
						_MeadowEndpoints.invokeEndpoint('Update', tmpRecord, {SessionData: _MockSessionValidUser},
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = pResponse.Record; //JSON.parse(pResponse.text);
								Expect(tmpResult.Type).to.equal('Corgi');
								Expect(tmpResult.CreatingIDUser).to.equal(1);
								Expect(tmpResult.UpdatingIDUser).to.equal(_MockSessionValidUser.UserID);
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke delete: delete a record',
					function(fDone)
					{
						// Delete animal 4 ("Corgi")
						var tmpRecord = {IDAnimal:4};

						// Override the query configuration
						_MeadowEndpoints.behaviorModifications.setBehavior('Delete-PreOperation',
							function(pRequest, fComplete)
							{
								// Create a custom property on the record.
								Expect(pRequest.Record.IDAnimal).to.equal(tmpRecord.IDAnimal);
								return fComplete(false);
							});
						
						_MeadowEndpoints.invokeEndpoint('Delete', tmpRecord, {SessionData: _MockSessionValidUser},
							function(pError, pResponse)
							{
								//clear out the behavior mapping to not affect other tests
								_MeadowEndpoints.behaviorModifications.setBehavior('Delete-PreOperation', null);

								// Expect response to be the count of deleted records.
								var tmpResult = pResponse.body; //JSON.parse(pResponse.text);
								Expect(tmpResult.Count).to.equal(1);
								return fDone();
							}
						);
					}
				);
				test
				(
					'invoke delete: delete a record with a bad parameter',
					function(fDone)
					{
						// Delete animal 3 ("Red")
						var tmpRecord = {IDAnimal:{MyStuff:4}};
						_MeadowEndpoints.invokeEndpoint('Delete', tmpRecord, {SessionData: _MockSessionValidUser},
							function(pError, pResponse)
							{
								// Expect response to be the count of deleted records.
								var tmpResult = pResponse.body; //JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('a valid record ID is required');
								fDone();
							}
						);
					}
				);
				test
				(
					'count: get the count of records',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('Count', {}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								var tmpResults = pResponse.body; //JSON.parse(pResponse.text);
								Expect(tmpResults.Count).to.equal(5);
								fDone();
							}
						);
					}
				);
				test
				(
					'schema: get the schema of a record',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('Schema', {},
							function (pError, pResponse)
							{
								var tmpResults = pResponse.body; //JSON.parse(pResponse.text);
								//console.log('SCHEMA --> '+JSON.stringify(tmpResults, null, 4))
								Expect(tmpResults.title).to.equal('Animal');
								Expect(tmpResults.description).to.contain('creature that lives in');
								fDone();
							}
						);
					}
				);
				test
				(
					'new: get a new empty record',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('New', {}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								var tmpResults = pResponse.body; //JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResults, null, 4))
								Expect(tmpResults.IDAnimal).to.equal(null);
								Expect(tmpResults.Name).to.equal('Unknown');
								Expect(tmpResults.Type).to.equal('Unclassified');
								fDone();
							}
						);
					}
				);
				test
				(
					'validate: validate an invalid record',
					function(fDone)
					{
						var tmpRecord = {IDAnimal:4, Type:'Corgi'};
						_MeadowEndpoints.invokeEndpoint('Validate', tmpRecord, {SessionData: _MockSessionValidUser},
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = pResponse.body; //JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResult, null, 4))
								Expect(tmpResult.Valid).to.equal(false);
								Expect(tmpResult.Errors[0].field).to.equal('data.Name');
								Expect(tmpResult.Errors[0].message).to.equal('is required');
								fDone();
							}
						);
					}
				);
				test
				(
					'validate: validate a valid record',
					function(fDone)
					{
						var tmpRecord = {IDAnimal:4, Type:'Corgi', Name:'Doofer', CreatingIDUser:10};
						_MeadowEndpoints.invokeEndpoint('Validate', tmpRecord, {SessionData: _MockSessionValidUser},
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = pResponse.body; //JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResult, null, 4))
								Expect(tmpResult.Valid).to.equal(true);
								fDone();
							}
						);
					}
				);
				test
				(
					'validate: validate bad data',
					function(fDone)
					{
						var tmpRecord = 'IAMBAD';
						_MeadowEndpoints.invokeEndpoint('Validate', tmpRecord, {SessionData: _MockSessionValidUser},
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = pResponse.body; //JSON.parse(pResponse.text);
								//console.log(JSON.stringify(tmpResult, null, 4))
								Expect(tmpResult.Error).to.contain('validate failure');
								fDone();
							}
						);
					}
				);
			}
		);

		suite
		(
			'Endpoint Security - Deny',
			function()
			{
				test
				(
					'invoke read: get a specific record',
					function(fDone)
					{
						_MockSessionValidUser.LoggedIn = true;
						_MockSessionValidUser.UserRoleIndex = 5; //set it to an undefined role, so the DefaultAPISecurity definitions of 'Deny' get used.

						_MeadowEndpoints.invokeEndpoint('Read', {IDRecord: 2}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								Expect(pResponse.body.ErrorCode).to.equal(405);
								Expect(pResponse.body.Error).to.equal('UNAUTHORIZED ACCESS IS NOT ALLOWED');
								return fDone();
							}
						);
					}
				);
				test
				(
					'invoke create: create a record',
					function(fDone)
					{
						var tmpRecord = {Name:'BatBrains', Type:'Mammoth'};
						_MeadowEndpoints.invokeEndpoint('Create', tmpRecord, {SessionData: _MockSessionValidUser},
							function(pError, pResponse)
							{
								Expect(pResponse.body.ErrorCode).to.equal(405);
								Expect(pResponse.body.Error).to.equal('UNAUTHORIZED ACCESS IS NOT ALLOWED');

								return fDone();
							}
						);
					}
				);
				test
				(
					'invoke create: create a record with a bad record passed in',
					function(fDone)
					{
						var tmpRecord = ' ';
						_MeadowEndpoints.invokeEndpoint('Create', tmpRecord, {SessionData: _MockSessionValidUser},
							function(pError, pResponse)
							{
								// Expect response to be the record we just created.
								var tmpResult = JSON.parse(pResponse.text);
								Expect(tmpResult.Error).to.contain('a valid record is required');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke readselect: get all records',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('ReadSelectList', {}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								Expect(pResponse.body.ErrorCode).to.equal(405);
								Expect(pResponse.body.Error).to.equal('UNAUTHORIZED ACCESS IS NOT ALLOWED');

								fDone();
							}
						);
					}
				);
				test
				(
					'invoke readsby: get all records by Type',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('ReadsBy', {ByField: 'Type', ByValue: 'Mammoth'}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								Expect(pResponse.body.ErrorCode).to.equal(405);
								Expect(pResponse.body.Error).to.equal('UNAUTHORIZED ACCESS IS NOT ALLOWED');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke readsby: get all records by Type IN LIST',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('ReadsBy', {ByField: 'Type', ByValue: ['Mammoth', 'Dog']}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								Expect(pResponse.body.ErrorCode).to.equal(405);
								Expect(pResponse.body.Error).to.equal('UNAUTHORIZED ACCESS IS NOT ALLOWED');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke countby: get cout of records by Type',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('CountBy', {ByField: 'Type', ByValue: 'Mammoth'}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								Expect(pResponse.body.ErrorCode).to.equal(405);
								Expect(pResponse.body.Error).to.equal('UNAUTHORIZED ACCESS IS NOT ALLOWED');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke countby: get cout of records by Type',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('Count', {}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								Expect(pResponse.body.ErrorCode).to.equal(405);
								Expect(pResponse.body.Error).to.equal('UNAUTHORIZED ACCESS IS NOT ALLOWED');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke readselect: get a page of records',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('ReadSelectList', {Begin: 2, Cap: 2}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								Expect(pResponse.body.ErrorCode).to.equal(405);
								Expect(pResponse.body.Error).to.equal('UNAUTHORIZED ACCESS IS NOT ALLOWED');
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke readselect: get an empty page of records',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('ReadSelectList', {Begin: 200, Cap: 200}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								// Because no records were returned, it should show as Authorized

								var tmpResults = pResponse.Records; //JSON.parse(pResponse.text);
								Expect(tmpResults.length).to.equal(0);
								fDone();
							}
						);
					}
				);
				test
				(
					'invoke reads: get a page of records',
					function(fDone)
					{
						_MeadowEndpoints.invokeEndpoint('Reads', {Begin: 2, Cap: 2}, {SessionData: _MockSessionValidUser},
							function (pError, pResponse)
							{
								Expect(pResponse.body.ErrorCode).to.equal(405);
								Expect(pResponse.body.Error).to.equal('UNAUTHORIZED ACCESS IS NOT ALLOWED');

								fDone();
							}
						);
					}
				);
				test
				(
					'invoke update: update a record',
					function(fDone)
					{
						// Change animal 1
						var tmpRecord = {IDAnimal:1, Type:'Corgi'};
						_MeadowEndpoints.invokeEndpoint('Update', tmpRecord, {SessionData: _MockSessionValidUser},
							function(pError, pResponse)
							{
								Expect(pResponse.body.ErrorCode).to.equal(405);
								Expect(pResponse.body.Error).to.equal('UNAUTHORIZED ACCESS IS NOT ALLOWED');

								fDone();
							}
						);
					}
				);
				test
				(
					'invoke delete: delete a record',
					function(fDone)
					{
						// Delete animal 1
						var tmpRecord = {IDAnimal:1};
						_MeadowEndpoints.invokeEndpoint('Delete', tmpRecord, {SessionData: _MockSessionValidUser},
							function(pError, pResponse)
							{
								Expect(pResponse.body.ErrorCode).to.equal(405);
								Expect(pResponse.body.Error).to.equal('UNAUTHORIZED ACCESS IS NOT ALLOWED');

								fDone();
							}
						);
					}
				);
			}
		);
	}
);