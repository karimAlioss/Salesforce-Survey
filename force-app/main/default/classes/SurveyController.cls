public with sharing class SurveyController {

    @AuraEnabled
    public static Id saveSurveyAndQuestions(String title, String description, String status, String category, String questionsJSON) {
        try {
            List<QuestionDTO> questions = (List<QuestionDTO>) JSON.deserialize(questionsJSON, List<QuestionDTO>.class);
            System.debug('📥 JSON payload received = simo: ' + JSON.serializePretty(questions));
            if (String.isBlank(title)) {
                throw new AuraHandledException('Survey title is required.');
            }

            if (String.isBlank(category)) {
                throw new AuraHandledException('Survey category is required.');
            }

            Survey__c survey;
            try {
                survey = new Survey__c(
                    Name = title,
                    Survey_Name__c = title,
                    Description__c = description,
                    Status__c = status,
                    Category__c = category
                );
                insert survey;
                System.debug('✅ Survey inserted: ' + survey.Id);
            } catch (Exception e) {
                System.debug('❌ Failed to insert Survey: ' + e.getMessage());
                throw new AuraHandledException('Failed to insert Survey: ' + e.getMessage());
            }

            List<Survey_Question__c> questionRecords = new List<Survey_Question__c>();
            List<QuestionDTO> validQuestions = new List<QuestionDTO>();

            try {
                for (QuestionDTO q : questions) {
                    System.debug('📨 Incoming QuestionDTO: ' + JSON.serializePretty(q));

                    if (String.isBlank(q.questionLabel)) {
                        System.debug('⛔ Skipped due to blank label');
                        continue;
                    }

                    Survey_Question__c sq = new Survey_Question__c(
                        Label__c = q.questionLabel,
                        Question_Type__c = q.questionType,
                        Required__c = q.required,
                        Order__c = q.questionOrder,
                        Section__c = q.sectionName,
                        Survey__c = survey.Id,
                        Allow_Multiple__c = q.questionType == 'Checkbox' ? q.allowMultiple : false
                    );

                    System.debug('🧾 Prepared Question Record: ' + JSON.serialize(sq));
                    questionRecords.add(sq);
                    validQuestions.add(q);
                }

                if (!questionRecords.isEmpty()) {
                    insert questionRecords;
                    System.debug('✅ Inserted questions: ' + questionRecords.size());
                } else {
                    System.debug('⚠️ No valid questions to insert.');
                }

            } catch (Exception e) {
                System.debug('❌ Error while processing questions: ' + e.getMessage());
                throw new AuraHandledException('Failed to process questions: ' + e.getMessage());
            }

            try {
                List<Survey_Option__c> optionRecords = new List<Survey_Option__c>();

                for (Integer i = 0; i < validQuestions.size(); i++) {
                    QuestionDTO q = validQuestions[i];
                    Survey_Question__c createdQ = questionRecords[i];

                    if (q.options != null && !q.options.isEmpty()) {
                        Integer order = 1;
                        for (OptionDTO opt : q.options) {
                            if (String.isBlank(opt.label)) {
                                System.debug('⚠️ Skipped blank option for question: ' + createdQ.Id);
                                continue;
                            }

                            Survey_Option__c so = new Survey_Option__c(
                                Label__c = opt.label,
                                Order__c = order++,
                                Survey_Question__c = createdQ.Id
                            );
                            optionRecords.add(so);
                        }
                    }
                }

                if (!optionRecords.isEmpty()) {
                    insert optionRecords;
                    System.debug('✅ Inserted options: ' + optionRecords.size());
                } else {
                    System.debug('⚠️ No options to insert.');
                }

            } catch (Exception e) {
                System.debug('❌ Error while processing options: ' + e.getMessage());
                throw new AuraHandledException('Failed to process options: ' + e.getMessage());
            }

            return survey.Id;

        } catch (Exception e) {
            System.debug('🔥 Top-level error: ' + e.getMessage());
            throw new AuraHandledException('Unexpected error: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getSurveyForPreview(Id surveyId) {
        try {
            Survey__c survey = [
                SELECT Id, Survey_Name__c, Description__c,
                       (SELECT Id, Label__c, Question_Type__c, Required__c, Order__c, Allow_Multiple__c,
                               (SELECT Id, Label__c, Order__c FROM Survey_Options__r ORDER BY Order__c ASC)
                        FROM Survey_Questions__r ORDER BY Order__c ASC)
                FROM Survey__c
                WHERE Id = :surveyId
                LIMIT 1
            ];

            List<Map<String, Object>> questionData = new List<Map<String, Object>>();
            for (Survey_Question__c q : survey.Survey_Questions__r) {
                questionData.add(new Map<String, Object>{
                    'Id' => q.Id,
                    'Label__c' => q.Label__c,
                    'Question_Type__c' => q.Question_Type__c,
                    'Required__c' => q.Required__c,
                    'Order__c' => q.Order__c,
                    'Allow_Multiple__c' => q.Allow_Multiple__c,
                    'Options' => q.Survey_Options__r
                });
            }

            return new Map<String, Object>{
                'survey' => survey,
                'questions' => questionData
            };
        } catch (Exception e) {
            System.debug('❌ getSurveyForPreview error: ' + e.getMessage());
            throw new AuraHandledException('Failed to load survey: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Survey__c> getAllSurveys() {
        try {
            List<Survey__c> surveys = [
                SELECT Id, Survey_Name__c, Description__c, Status__c, Category__c, CreatedDate
                FROM Survey__c
                WHERE Status__c IN ('Draft', 'Published')
                ORDER BY LastModifiedDate DESC
            ];
            System.debug('📊 Loaded surveys: ' + surveys.size());
            return surveys;
        } catch (Exception e) {
            System.debug('❌ getAllSurveys error: ' + e.getMessage());
            throw new AuraHandledException('Unable to load surveys: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteSurvey(Id surveyId) {
        try {
            List<Survey_Question__c> questions = [
                SELECT Id FROM Survey_Question__c
                WHERE Survey__c = :surveyId
            ];

            List<Survey_Option__c> options = [
                SELECT Id FROM Survey_Option__c
                WHERE Survey_Question__c IN :questions
            ];

            delete options;
            delete questions;
            delete [SELECT Id FROM Survey__c WHERE Id = :surveyId];

            System.debug('🗑️ Survey and related records deleted');
        } catch (Exception e) {
            System.debug('❌ Delete error: ' + e.getMessage());
            throw new AuraHandledException('Failed to delete survey: ' + e.getMessage());
        }
    }

}
