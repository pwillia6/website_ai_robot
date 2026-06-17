<?php
namespace WebRobot;

require_once __DIR__ . '/WebRobotMailer.php';

class WebRobotMailer_Default implements WebRobotMailer {
    public function __construct(array $configData) {
        // This default mailer doesn't need any config, but accepts it for interface consistency.
    }

    public function send($to, $subject, $body, $from_email, $from_name) {
        $log_message = "--- New Mail Send ---\n";
        $log_message .= "To: {$to}\n";
        $log_message .= "From: {$from_name} <{$from_email}>\n";
        $log_message .= "Subject: {$subject}\n";
        $log_message .= "Body:\n{$body}\n";
        $log_message .= "--- End of Mail ---\n";

        return error_log($log_message);
    }

    public function sendContactForm($name, $from_email, $subject, $message) {
        $log_message = "--- New Contact Form Submission ---\n";
        $log_message .= "Name: {$name}\n";
        $log_message .= "Email: {$from_email}\n";
        $log_message .= "Subject: {$subject}\n";
        $log_message .= "Message:\n{$message}\n";
        $log_message .= "--- End of Submission ---\n";

        return error_log($log_message);
    }
}
?>