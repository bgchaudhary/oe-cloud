/**
 * 
 * ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 * 
 */
/*global
    require,before,after,it,describe
*/
var chalk = require('chalk');
var bootstrap = require('./bootstrap');
var expect = bootstrap.chai.expect;
var loopback = require('loopback');
var models = bootstrap.models;

// This test case is for composite model functionality
// 1. Creates Customer, CustomerAddress and UpcomingEvent models and creates additional CompositeModel which combines Customer and UpcomingEvent models.
// 2. Create record by posting into CompositeModel - this should in turn create records in Customer and CustomerAddress and unrelated UpcomingEvent model. Explicit row_status is given against record.
// 3. Tests the records being created by querying these tables separately
// 4. Update selective records by doing again POST operation on Composite model
// 5. Test the update by separately querying data.
// 6. Implicit composite test - posting data to Customer along with CustomerAddress with relation
// 7. Test to perform validations to see if duplicate record fails - create CustomerAddress duplicate

describe(chalk.blue('Composite Model test'), function () {
    this.timeout(60000);
    var callContext = {
        ctx: {
            tenantId: 'test-tenant',
            remoteUser: 'test-user'
        }
    };

    before('setup test data', function (done) {
        models.ModelDefinition.create({
            'name': 'Customer',
            'idInjection': false,
            'base': 'BaseEntity',
            'mixins': {
                'VersionMixin': false,
                'IdempotentMixin': false,
            },
            properties: {
                'name': {
                    'type': 'string',
                    'required': true
                },
                'contact': {
                    'type': 'object'
                }
            },
            'relations': {
                'address': {
                    'type': 'hasMany',
                    'model': 'CustomerAddress',
                    'foreignKey': 'customerId'
                }
            },
            'filebased': false
        }, callContext, function (err, model) {
            console.log(err);
            expect(err).to.be.not.ok;
            models.ModelDefinition.create({
                name: 'UpcomingEvent',
                'idInjection': false,
                base: 'BaseEntity',
                'mixins': {
                    'VersionMixin': false,
                    'IdempotentMixin': false,
                },
                properties: {
                    'eventName': {
                        'type': 'string',
                        'required': true
                    },
                    'eventDescription': {
                        'type': 'string'
                    },
                    'activeFlag': {
                        'type': 'boolean'
                    }
                },
                relations: {},
                filebased: false
            }, callContext, function (err, upcomingEventrcd) {
                expect(err).to.be.null;
                models.ModelDefinition.create({
                    name: 'CustomerAddress',
                    'idInjection': false,
                    base: 'BaseEntity',
                    'mixins': {
                        'VersionMixin': false,
                        'IdempotentMixin': false,
                    },
                    properties: {
                        'city': {
                            'type': 'string',
                            'required': true
                        },
                        'state': {
                            'type': 'object'
                        }
                    },
                    relations: {
                        'address': {
                            'type': 'belongsTo',
                            'model': 'Customer',
                            'foreignKey': 'customerId'

                        }
                    },
                    filebased: false
                }, callContext, function (err2, model2) {
                    expect(err2).to.be.null;
                    models.ModelDefinition.create({
                        name: 'CompositeModel',
                        base: 'BaseEntity',
                        'mixins': {
                            'VersionMixin': false,
                            'IdempotentMixin': false,
                        },
                        strict: false,
                        properties: {},
                        filebased: false,
                        CompositeTransaction: true,
                        compositeModels: {
                            'Customer': {},
                            'UpcomingEvent': {}
                        }
                    }, callContext, function (err3, model3) {
                        expect(err3).to.be.not.ok;
                        models.ModelDefinition.create({
                            name: 'HOUser',
                            'idInjection': false,
                            base: 'BaseEntity',
                            'mixins': {
                                'VersionMixin': false,
                                'IdempotentMixin': false,
                            },
                            properties: {
                                name: {
                                    type: 'string'
                                }
                            },
                            relations: {
                                preferences: {
                                type: 'hasOne',
                                model: 'HOPreferences',
                                foreignKey: 'userId'
                            }
                            }
                        }, callContext, function(err4, model4){
                            models.ModelDefinition.create({
                                name: 'HOPreferences',
                                'idInjection': false,
                                base: 'BaseEntity',
                                'mixins': {
                                    'VersionMixin': false,
                                    'IdempotentMixin': false,
                                },
                                properties: {
                                    choice1: {
                                        type: 'string'
                                    },
                                    flag1: {
                                        type: 'boolean'
                                    }
                                },
                                relations: {
                                    preferences: {
                                        type: 'hasOne',
                                        model: 'HOPreferences',
                                        foreignKey: 'userId'
                                    }
                                }
                            }, callContext, function(err5, model5){
                                expect(err5).to.be.not.ok;
                                return done(err5);
                            });
                        })
                    });
                });
            });
        });
    });

    after('destroy test models', function (done) {
        models.ModelDefinition.destroyAll({
            name: 'HOPreferences'
        }, callContext, function () { });
        models.ModelDefinition.destroyAll({
            name: 'HOUser'
        }, callContext, function () { });
        models.ModelDefinition.destroyAll({
            name: 'Customer'
        }, callContext, function () { });
        models.ModelDefinition.destroyAll({
            name: 'UpcomingEvent'
        }, callContext, function () { });
        models.ModelDefinition.destroyAll({
            name: 'CustomerAddress'
        }, callContext, function () { });
        loopback.findModel("HOPreferences", callContext).destroyAll({}, callContext, function () { });
        loopback.findModel("HOUser", callContext).destroyAll({}, callContext, function () { });
        loopback.findModel("Customer", callContext).destroyAll({}, callContext, function () { });
        loopback.findModel("CustomerAddress", callContext).destroyAll({}, callContext, function () { });
        loopback.findModel("UpcomingEvent", callContext).destroyAll({}, callContext, function () { });
        models.ModelDefinition.destroyAll({
            name: 'CompositeModel'
        }, callContext, function () {
            done();
        });
    });

    it('Composite Model test - should create nested 1 record in customer & 2 record in address and 1 record in UpcomingEvent model ', function (done) {
        var compositeModel = loopback.getModel('CompositeModel', callContext);
        console.log('composit model customer create');
        compositeModel.create({
            'Customer': [{
                'name': 'Smith',
                'id': 1,
                '__row_status': 'added',
                'address': [{
                    'city': 'Delhi',
                    'id': 11,
                    '__row_status': 'added'
                }, {
                    'id': 12,
                    'city': 'Mumbai',
                    '__row_status': 'added'
                }]
            }],
            'UpcomingEvent': [{
                'eventName': 'A.R. Raheman concert',
                'eventDescription': 'Concert is free for all Icici bank users',
                'activeFlag': true,
                '__row_status': 'added',
                'id': 1
            }]

        }, callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            expect(results).to.have.property('Customer');
            expect(results.Customer[0]).to.have.property('name');
            expect(results.Customer[0]).to.have.property('address');
            expect(results.Customer[0].name).to.equal('Smith');
            expect(results.Customer[0].address[0].city).to.equal('Delhi');
            expect(results.Customer[0].address[1].city).to.equal('Mumbai');
            expect(results).to.have.property('UpcomingEvent');
            expect(results.UpcomingEvent[0]).to.have.property('eventName');
            expect(results.UpcomingEvent[0].eventName).to.equal('A.R. Raheman concert');

            done();
        });
    });

    it('Composite Model test - should create nested 2 record in customer & 4 record in address ', function (done) {
        var compositeModel = loopback.getModel('CompositeModel', callContext);
        compositeModel.create({
            'Customer': [{
                'name': 'Williams',
                'id': 2,
                '__row_status': 'added',
                'address': [{
                    'city': 'Hyderabad',
                    'id': 13,
                    '__row_status': 'added'
                }, {
                    'id': 14,
                    'city': 'Secunderabad',
                    '__row_status': 'added'
                }]
            }, {
                'name': 'John',
                'id': 3,
                '__row_status': 'added',
                'address': [{
                    'city': 'Bangalore',
                    'id': 15,
                    '__row_status': 'added'
                }, {
                    'id': 16,
                    'city': 'Chennai',
                    '__row_status': 'added'
                }]
            }],
            'UpcomingEvent': [{
                'eventName': 'India vs Australia match',
                'eventDescription': '50% discount for all Icici bank users',
                'activeFlag': true,
                '__row_status': 'added',
                'id': 2
            },
            {
                'eventName': 'New year celebration',
                'eventDescription': '50% discount for all Icici bank users',
                'activeFlag': true,
                '__row_status': 'added',
                'id': 3
            }
            ]
        }, callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            expect(results).to.have.property('Customer');
            expect(results.Customer[0]).to.have.property('name');
            expect(results.Customer[0]).to.have.property('address');
            expect(results.Customer[0].name).to.equal('Williams');
            expect(results.Customer[0].address[0].city).to.equal('Hyderabad');
            expect(results.Customer[0].address[1].city).to.equal('Secunderabad');
            expect(results.Customer[1].name).to.equal('John');
            expect(results.Customer[1].address[0].city).to.equal('Bangalore');
            expect(results.Customer[1].address[1].city).to.equal('Chennai');

            expect(results).to.have.property('UpcomingEvent');
            expect(results.UpcomingEvent[0]).to.have.property('eventName');
            expect(results.UpcomingEvent[0].eventName).to.equal('India vs Australia match');
            expect(results.UpcomingEvent[1]).to.have.property('eventName');
            expect(results.UpcomingEvent[1].eventName).to.equal('New year celebration');
            done();
        });
    });

    it('should get the customer based on where condition', function (done) {
        var customer = loopback.getModel('Customer', callContext);
        customer.find({
            where: {
                'name': 'Smith'
            }
        },
            callContext,
            function (err, results) {
                expect(results[0].name).to.equal('Smith');
                done();
            });

    });

    it('should get the customer based on where condition', function (done) {
        var customer = loopback.getModel('Customer', callContext);
        customer.find({
            where: {
                'name': 'Williams'
            }
        },
            callContext,
            function (err, results) {
                expect(results[0].name).to.equal('Williams');
                done();
            });

    });

    it('should get the customer based on where condition', function (done) {
        var customer = loopback.getModel('Customer', callContext);
        customer.find({
            where: {
                'name': 'John'
            }
        },
            callContext,
            function (err, results) {
                expect(results[0].name).to.equal('John');
                done();
            });

    });

    it('should get the CustomerAddress based on where condition', function (done) {
        var customerAddress = loopback.getModel('CustomerAddress', callContext);
        customerAddress.find({
            where: {
                'city': 'Delhi'
            }
        },
            callContext,
            function (err, results) {
                expect(results[0].city).to.equal('Delhi');
                expect(results[0].customerId === "1" || results[0].customerId === 1).to.be.ok;
                done();
            });
    });



    it('Composite Model test - 1 customer record should be updated, 1 address recourd should be updated', function (done) {
        var compositeModel = loopback.getModel('CompositeModel', callContext);
        compositeModel.create({
            'Customer': [{
                'name': 'Smith_Changed',
                'id': 1,
                '__row_status': 'modified',
                'address': [{
                    'city': 'DELHI_CAPITAL',
                    'id': 11,
                    '__row_status': 'modified'
                }]
            }],
            'UpcomingEvent': [{
                'eventName': 'India vs Australia match - Expired',
                'activeFlag': false,
                '__row_status': 'modified',
                'id': 2
            },
            {
                'eventName': 'New year celebration',
                'eventDescription': '50% discount for all Icici bank users',
                'activeFlag': false,
                '__row_status': 'deleted',
                'id': 3
            }]
        }, callContext, function (err, results) {
            if (err) {
                console.log(err);
                return done(err);
            }
            expect(results).to.have.property('Customer');
            expect(results.Customer[0]).to.have.property('name');
            expect(results.Customer[0]).to.have.property('address');
            expect(results.Customer[0].name).to.equal('Smith_Changed');
            expect(results.Customer[0].address[0].city).to.equal('DELHI_CAPITAL');
            expect(results).to.have.property('UpcomingEvent');
            expect(results.UpcomingEvent[0]).to.have.property('eventName');
            expect(results.UpcomingEvent[0].eventName).to.equal('India vs Australia match - Expired');
            done();
        });
    });

    it('should get the customer based on where condition', function (done) {
        var customer = loopback.getModel('Customer', callContext);
        customer.find({
            where: {
                'name': 'Smith_Changed'
            }
        }, callContext,
            function (err, results) {
                expect(results[0].name).to.equal('Smith_Changed');
                done();
            });

    });

    it('should get the CustomerAddress based on where condition', function (done) {
        var customerAddress = loopback.getModel('CustomerAddress', callContext);
        customerAddress.find({
            where: {
                'city': 'DELHI_CAPITAL'
            }
        }, callContext,
            function (err, results) {
                expect(results[0].city).to.equal('DELHI_CAPITAL');
                expect(results[0].customerId === "1" || results[0].customerId === 1).to.be.ok;
                done();
            });
    });

    it('should not get the UpcomingEvent record as record is deleted', function (done) {
        var upcomingEvent = loopback.getModel('UpcomingEvent', callContext);
        upcomingEvent.find({
            where: {
                'id': 3
            }
        }, callContext,
            function (err, results) {
                expect(results.length).to.equal(0);
                done();
            });
    });



    it('Implicit Composite Model test - 1 customer record should be created and 2 address records should be created', function (done) {
        var customer = loopback.getModel('Customer', callContext);
        customer.create({
            'name': 'Michael',
            'id': 4,
            'address': [{
                'city': 'San Jose',
                'id': 22
            }, {
                'id': 23,
                'city': 'New York'
            }]
        }, callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            expect(results).to.have.property('name');
            expect(results).to.have.property('id');
            expect(results.__data).to.have.property('address');
            expect(results.name).to.equal('Michael');
            expect(results.__data.address[0]).to.have.property('city');
            expect(results.__data.address[0].city).to.equal('San Jose');
            expect(results.__data.address[1].city).to.equal('New York');
            done();
        });
    });

    it('should get the customer based on where condition', function (done) {
        var customer = loopback.getModel('Customer', callContext);
        customer.find({
            where: {
                'name': 'Michael'
            }
        }, callContext,
            function (err, results) {
                expect(results[0].__data.name).to.equal('Michael');
                done();
            });
    });

    it('should get the CustomerAddress based on where condition', function (done) {
        var customerAddress = loopback.getModel('CustomerAddress', callContext);
        customerAddress.find({
            where: {
                'city': 'San Jose'
            }
        }, callContext,
            function (err, results) {
                expect(results[0].__data.city).to.equal('San Jose');
                expect(results[0].__data.customerId === "4" || results[0].__data.customerId === 4).to.be.ok;
                done();
            });
    });

    it('Implicit Composite Model test - 1 customer record should be created and 2 address records should be created', function (done) {
        var customer = loopback.getModel('Customer', callContext);
        customer.create([{
            'name': 'Tom',
            'id': 5,
            'address': [{
                'city': 'Denver',
                'id': 24,
            }, {
                'id': 25,
                'city': 'Frankfort'
            }]
        }, {
            'name': 'Harry',
            'id': 6,
            'address': [{
                'city': 'London',
                'id': 26
            }, {
                'id': 27,
                'city': 'Paris'
            }]
        }], callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            expect(results[0]).to.have.property('name');
            expect(results[0]).to.have.property('id');
            expect(results[0]).to.have.property('address');
            expect(results[0].name).to.equal('Tom');
            expect(results[0].__data.address[0]).to.have.property('city');
            expect(results[0].__data.address[0].city).to.equal('Denver');
            expect(results[0].__data.address[1].city).to.equal('Frankfort');
            expect(results[1]).to.have.property('name');
            expect(results[1]).to.have.property('id');
            expect(results[1]).to.have.property('address');
            expect(results[1].name).to.equal('Harry');
            expect(results[1].__data.address[0]).to.have.property('city');
            expect(results[1].__data.address[0].city).to.equal('London');
            expect(results[1].__data.address[1].city).to.equal('Paris');
            done();
        });
    });

    it('should get the customer based on where condition', function (done) {
        var customer = loopback.getModel('Customer', callContext);
        customer.find({
            where: {
                'name': 'Tom'
            }
        }, callContext,
            function (err, results) {
                expect(results[0].__data.name).to.equal('Tom');
                done();
            });

    });

    it('should get the customer based on where condition', function (done) {
        var customer = loopback.getModel('Customer', callContext);
        customer.find({
            where: {
                'name': 'Harry'
            }
        }, callContext,
            function (err, results) {
                expect(results[0].__data.name).to.equal('Harry');
                done();
            });

    });


    it('should get the CustomerAddress based on where condition', function (done) {
        var customerAddress = loopback.getModel('CustomerAddress', callContext);
        customerAddress.find({
            where: {
                'city': 'Frankfort'
            }
        }, callContext,
            function (err, results) {
                expect(results[0].__data.city).to.equal('Frankfort');
                expect(results[0].__data.customerId === "5" || results[0].__data.customerId === 5).to.be.ok;
                done();
            });
    });

    it('should get the CustomerAddress based on where condition', function (done) {
        var customerAddress = loopback.getModel('CustomerAddress', callContext);
        customerAddress.find({
            where: {
                'city': 'London'
            }
        }, callContext,
            function (err, results) {
                expect(results[0].__data.city).to.equal('London');
                expect(results[0].__data.customerId === "6" || results[0].__data.customerId === 6).to.be.ok;
                done();
            });
    });


    it('Composite Model test - should create 1 record in customer without address ', function (done) {
        var compositeModel = loopback.getModel('CompositeModel', callContext);
        compositeModel.create({
            'Customer': [{
                'name': 'Jim',
                'id': 10,
                '__row_status': 'added'
            }]
        }, callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            expect(results).to.have.property('Customer');
            expect(results.Customer[0]).to.have.property('name');
            expect(results.Customer[0].name).to.equal('Jim');
            done();
        });
    });

    it('Implicit Composite Model test - should create 1 record in customer even though customerId not present as belongs to is ignored in transaction ', function (done) {
        var compositeModel = loopback.getModel('Customer', callContext);
        compositeModel.create({
            'name': 'Bala',
            'id': 11,
            '__row_status': 'added',
            'address': [{
                'city': 'Brisbon',
                'id': 31
            }, {
                'id': 32,
                'city': 'Vatican'
            }]
        }, callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            expect(results).to.have.property('name');
            expect(results).to.have.property('id');
            expect(results).to.have.property('address');
            expect(results.name).to.equal('Bala');
            expect(results.__data.address[0]).to.have.property('city');
            expect(results.__data.address[0].city).to.equal('Brisbon');
            expect(results.__data.address[1].city).to.equal('Vatican');
            done();
        });
    });

    it('Implicit Composite Model test - should fail to create 1 record in customer as one addressId not valid ', function (done) {
        var compositeModel = loopback.getModel('Customer', callContext);
        compositeModel.create({
            'name': 'Raj',
            'id': 12,
            '__row_status': 'added',
            'address': [{
                'city': 'Kolkata',
                'id': 31
            }, {
                'id': 32,
                'city': 'Katak'
            }]
        }, callContext, function (err, results) {
            expect(err).not.null;
            done();
        });
    });

    it('implicit composit post should fail and throw the error when improper parent data is passed to parent model', function (done) {
        var parentModel = loopback.getModel('Customer', callContext);
        parentModel.observe('before save', function (ctx, next) {
            var data = ctx.instance || ctx.data;
            if (data.contact.mobile)
                return next();
            return next();
        });

        var postData = {
            'name': 'Kirito',
            'id': 'K7D3',
            'address': [{
                'city': 'MoonLand',
                'id': 'X22'
            }]
        };
        parentModel.create(postData, callContext, function (err, res) {
            if (err) {
                done();
            } else {
                done('should fail and throw the error when improper parent data is passed on parent model');
            }
        });

    });

    it('implicit composit post should fail and throw the error when improper child data is passed to parent model', function (done) {
        var parentModel = loopback.getModel('Customer', callContext);
        var childModel = loopback.getModel('CustomerAddress', callContext);
        childModel.observe('before save', function (ctx, next) {
            var data = ctx.instance || ctx.data;
            if (data.state.capital)
                return next();
            return next();
        });

        var postData = {
            'name': 'Asuna',
            'contact': { 'mobile': 'HIDDEN_NUMBER' },
            'id': 'K7D4',
            'address': [{
                'city': 'SkyWalk',
                'id': 'X42'
            }]
        };
        parentModel.create(postData, callContext, function (err, res) {
            if (err) {
                done();
            } else {
                done('should fail and throw the error when improper child data is passed on parent model');
            }
        });

    });
/************************* */
/************************* */
    it('hasOne Child posted as [{}], record is created and returned in array', function (done) {
        var customer = loopback.getModel('HOUser', callContext);
        customer.create({
                name: 'Smith',
                id: 1001,
                preferences: [{
                    choice1: 'Delhi',
                    flag1: true
                }]
        }, callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            var response = results.__data;
            expect(response).to.have.property('name');
            expect(response).to.have.property('preferences');
            expect(response.preferences).to.be.an('array');
            expect(response.preferences[0]).to.have.property('choice1');
            expect(response.preferences[0]).to.have.property('flag1');
            done();
        });
    });

    it('hasOne Child posted as [{}], can be added later as part of PUT', function (done) {
        var customer = loopback.getModel('HOUser', callContext);
        customer.create({
                name: 'Smith',
                id: 1002
        }, callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            var response = results.__data;
            expect(response).to.have.property('name');
            expect(response).to.not.have.property('preferences');
            response.preferences = [{__row_status:'added',choice1: 'Bengaluru', flag1: false}];

            customer.upsert(response, callContext, function(err2, results2){
                if (err2) {
                    return done(err2);
                }
                    
                var response2 = results2.__data;
                expect(response2).to.have.property('preferences');
                expect(response2.preferences).to.be.an('array');
                expect(response2.preferences[0]).to.have.property('choice1');
                expect(response2.preferences[0]).to.have.property('flag1');
                done();
            });
        });
    });

    it('hasOne Child posted as [{}], record can be deleted', function (done) {
        var customer = loopback.getModel('HOUser', callContext);
        customer.create({
                name: 'Smith',
                id: 1003,
                preferences: [{
                    choice1: 'Delhi',
                    flag1: true
                }]
        }, callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            var response = results.__data;
            expect(response).to.have.property('name');
            expect(response).to.have.property('preferences');
            expect(response.preferences).to.be.an('array');

            response.preferences[0].__row_status = 'deleted';
            customer.upsert(response, callContext, function(err2, results2){
                if (err2) {
                    return done(err2);
                }

                var response2 = results2.__data;
                expect(response2).to.not.have.property('preferences');
                done();
            });

        });
    });

    it('hasOne Child posted as {}, record is created and returned as object', function (done) {
        var customer = loopback.getModel('HOUser', callContext);
        customer.create({
                name: 'Smith',
                id: 2001,
                preferences: {
                    choice1: 'Delhi',
                    flag1: true
                }
        }, callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            var response = results.__data;
            expect(response).to.have.property('name');
            expect(response).to.have.property('preferences');
            expect(response.preferences).to.be.ok;
            expect(response.preferences).to.not.be.an('array');
            expect(response.preferences).to.have.property('choice1');
            expect(response.preferences).to.have.property('flag1');
            done();
        });
    });

    it('hasOne Child posted as {}, can be added later as part of PUT', function (done) {
        var customer = loopback.getModel('HOUser', callContext);
        customer.create({
                name: 'Smith',
                id: 2002
        }, callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            var response = results.__data;
            expect(response).to.have.property('name');
            expect(response).to.not.have.property('preferences');
            response.preferences = {__row_status:'added',choice1: 'Bengaluru', flag1: false};

            customer.upsert(response, callContext, function(err2, results2){
                if (err2) {
                    return done(err2);
                }
                    
                var response2 = results2.__data;
                expect(response2).to.have.property('preferences');
                expect(response2.preferences).to.be.ok;
                expect(response2.preferences).to.not.be.an('array');
                expect(response2.preferences).to.have.property('choice1');
                expect(response2.preferences).to.have.property('flag1');
                done();
            });
        });
    });

    it('hasOne Child posted as {}, record can be deleted', function (done) {
        var customer = loopback.getModel('HOUser', callContext);
        customer.create({
                name: 'Smith',
                id: 2003,
                preferences: {
                    choice1: 'Delhi',
                    flag1: true
                }
        }, callContext, function (err, results) {
            if (err) {
                return done(err);
            }
            var response = results.__data;
            expect(response).to.have.property('name');
            expect(response).to.have.property('preferences');
            expect(response.preferences).to.be.ok;

            response.preferences.__row_status = 'deleted';
            customer.upsert(response, callContext, function(err2, results2){
                if (err2) {
                    return done(err2);
                }

                var response2 = results2.__data;
                expect(response2).to.not.have.property('preferences');
                done();
            });

        });
    });
    
});
