<?php
namespace WebRobot;

interface WebRobotMailer {
    public function __construct(array $configData);
    public function send($to, $subject, $body, $from_email, $from_name);
    public function sendContactForm($name, $from_email, $subject, $message);
}

?>